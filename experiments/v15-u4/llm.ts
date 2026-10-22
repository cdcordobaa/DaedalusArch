/**
 * U4 (v1.5-exp): the one provider path of S3 and S2. `claude -p --model claude-sonnet-5-5`, no tools, run from an
 * empty temporary directory with project settings only (as U3), the prompt on stdin, a JSON schema for the answer.
 *
 * HARD CAP 75 calls for all of U4 (note §6), counted as lines of `ledger.jsonl` (every attempt and retry is one line).
 * There is no flag to raise it. Every answer is a cassette keyed by the sha256 of (part, prompt version, model,
 * system, schema, prompt); a cassette hit costs no call, and `replay` mode never calls (a miss is an invalid answer).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const HERE = 'experiments/v15-u4';
export const HARD_CAP = 75;
export const MODEL = 'claude-sonnet-5-5';
export const LEDGER = path.join(HERE, 'ledger.jsonl');
const TIMEOUT_MS = 300_000;

export type Mode = 'estimate' | 'record' | 'replay';
export const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

export function ledgerCount(): number {
  return fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').length : 0;
}

interface CliResult { readonly answer: unknown; readonly model: string | null; readonly durationMs: number; readonly error: string | null; readonly inputTokens: number | null; readonly outputTokens: number | null }

function callClaude(system: string, schema: object, prompt: string): Promise<CliResult> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-u4-call-'));
  const args = ['-p', '--model', MODEL, '--output-format', 'json', '--json-schema', JSON.stringify(schema),
    '--system-prompt', system, '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools', ''];
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(cwd, { recursive: true, force: true });
      const durationMs = Date.now() - t0;
      let env: Record<string, unknown> | null = null;
      try { env = JSON.parse(stdout) as Record<string, unknown>; } catch { env = null; }
      if (env === null) { resolve({ answer: null, model: null, durationMs, error: `exit ${String(code)}; no JSON envelope; ${stderr.slice(0, 200)}`, inputTokens: null, outputTokens: null }); return; }
      const usage = env['modelUsage'] as Record<string, unknown> | undefined;
      const model = usage !== undefined ? Object.keys(usage).sort().join('+') : null;
      const u = env['usage'] as { input_tokens?: number; output_tokens?: number } | undefined;
      const tok = { inputTokens: u?.input_tokens ?? null, outputTokens: u?.output_tokens ?? null };
      if (env['is_error'] === true || code !== 0) { resolve({ answer: null, model, durationMs, error: `exit ${String(code)}; ${String(env['result'] ?? '').slice(0, 200)}`, ...tok }); return; }
      let answer: unknown = env['structured_output'];
      if (answer === undefined && typeof env['result'] === 'string') { try { answer = JSON.parse(env['result']); } catch { answer = null; } }
      resolve({ answer: answer ?? null, model, durationMs, error: null, ...tok });
    });
    child.stdin.end(prompt);
  });
}

export interface AskSpec {
  readonly part: 'S3' | 'S2';
  readonly item: string;
  readonly run: number;
  readonly promptVersion: string;
  readonly system: string;
  readonly schema: object;
  readonly prompt: string;
  /** Null when valid, else the reason (one retry on an invalid answer). */
  readonly check: (a: unknown) => string | null;
}
export interface Asked { readonly answer: unknown; readonly cached: boolean; readonly key: string; readonly model: string | null; readonly invalid: string | null }

export const keyOf = (s: AskSpec): string => sha([s.part, s.promptVersion, MODEL, String(s.run), s.system, JSON.stringify(s.schema), s.prompt].join('\n'));
const cassetteOf = (s: AskSpec, key: string): string => path.join(HERE, 'cassettes', s.part.toLowerCase(), `${key.slice(0, 24)}.json`);

export interface Budget { readonly mode: Mode; readonly partCap: number; used: number; stopped: string | null }

/** Ask once (with one retry on an invalid answer), or replay. Never passes the hard cap or the part's cap. */
export async function ask(s: AskSpec, b: Budget): Promise<Asked> {
  const key = keyOf(s);
  const cp = cassetteOf(s, key);
  if (fs.existsSync(cp)) {
    const c = JSON.parse(fs.readFileSync(cp, 'utf8')) as { answer: unknown; model: string | null };
    return { answer: c.answer, cached: true, key, model: c.model, invalid: c.answer === null ? 'recorded-invalid' : s.check(c.answer) };
  }
  if (b.mode === 'estimate') { b.used++; return { answer: null, cached: false, key, model: null, invalid: 'not-asked' }; }
  if (b.mode === 'replay' || b.stopped !== null) return { answer: null, cached: false, key, model: null, invalid: b.mode === 'replay' ? 'cassette-miss' : 'stopped' };
  let answer: unknown = null; let reason: string | null = null; let model: string | null = null;
  for (let attempt = 0; attempt < 2 && answer === null; attempt++) {
    const total = ledgerCount();
    if (total >= HARD_CAP || b.used >= b.partCap) { b.stopped = `cap reached (ledger ${String(total)} of ${String(HARD_CAP)}; part ${String(b.used)} of ${String(b.partCap)})`; reason = 'cap'; break; }
    const res = await callClaude(s.system, s.schema, s.prompt);
    const problem = res.error ?? s.check(res.answer);
    model = res.model;
    fs.appendFileSync(LEDGER, `${JSON.stringify({
      n: total + 1, at: new Date().toISOString(), part: s.part, item: s.item, run: s.run, attempt, requestedModel: MODEL, model: res.model, promptVersion: s.promptVersion,
      key: key.slice(0, 24), durationMs: res.durationMs, inputTokens: res.inputTokens, outputTokens: res.outputTokens, ok: problem === null, problem,
    })}\n`);
    b.used++;
    if (problem === null) answer = res.answer; else reason = problem;
  }
  if (answer === null && reason === 'cap') return { answer: null, cached: false, key, model, invalid: 'cap' };
  fs.mkdirSync(path.dirname(cp), { recursive: true });
  fs.writeFileSync(cp, `${JSON.stringify({ key, part: s.part, item: s.item, run: s.run, promptVersion: s.promptVersion, requestedModel: MODEL, model, date: new Date().toISOString(), answer, invalidReason: answer === null ? reason : null }, null, 1)}\n`);
  return { answer, cached: false, key, model, invalid: answer === null ? reason : null };
}
