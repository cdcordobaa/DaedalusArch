/**
 * U3 (S1) severity pilot runner (`ops/notes/v15-u3-severity-note.md`). DEVELOPMENT MATERIAL ONLY, exploratory.
 *
 * Per project: C3 on `cypher-interp` and the C4 contexts, through the v1.4 runner's own preparation (read-only import
 * of `scripts/v1.4/c4-run.ts`); then **only the manifest's target finding** gets one call per run, with the U3 prompt
 * variant (`prompt.ts`), through `claude -p`. Answers are schema-checked, grounded (`groundC4Answer`), merged
 * (`a5Entry`) and scored (`scoreC4Case`), all frozen code.
 *
 * Every provider call is a line in `ledger.jsonl`, and the runner refuses a call once the ledger holds `HARD_CAP`
 * lines. Every answer is a cassette under `cassettes/<arm>/<project>/`; `--replay` answers from them only (a miss is
 * an invalid run, never a call), so a replay costs zero calls.
 *
 * Usage (repository root):
 *   npx tsx experiments/v15-u3/run.ts --set all --arm rubric --estimate
 *   npx tsx experiments/v15-u3/run.ts --set all --arm rubric --record
 *   npx tsx experiments/v15-u3/run.ts --set all --arm rubric --replay
 *   npx tsx experiments/v15-u3/run.ts --set original --arm control --only c4-04t-superseded-adr,c4-05-intent-contradicted --record
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { sha256Hex } from '../../src/llm-critic/canonical-json.js';
import { a5Entry, groundC4Answer } from '../../src/apg-enrich/ontology/c4-contract.js';
import type { A5Entry, C4Run } from '../../src/apg-enrich/ontology/c4-contract.js';
import { scoreC4Case, targetEntry } from '../../src/apg-enrich/ontology/c4-scorer.js';
import type { C4CaseScore } from '../../src/apg-enrich/ontology/c4-scorer.js';
import { INTENT_STATUSES, INTERPRETATION_SCHEMA, INTERPRETATION_SYSTEM, SEVERITY_CLASSES } from '../../src/apg-enrich/ontology/interpretation.js';
import type { C4Answer } from '../../src/apg-enrich/ontology/interpretation.js';
import { baselineOf, prepareC4Project, setTargets } from '../../scripts/v1.4/c4-run.js';
import type { C4Target, PreparedItem } from '../../scripts/v1.4/c4-run.js';
import { U3_PROMPT_VERSION, controlPrompt, rubricPrompt } from './prompt.js';

export const HERE = 'experiments/v15-u3';
export const HARD_CAP = 60;
export const MODEL = 'claude-sonnet-5-5';
export const SETS = { original: 'tests/fixtures/v1.4-c4/set.json', new: `${HERE}/cases/set.json` } as const;
const LEDGER = path.join(HERE, 'ledger.jsonl');
const TIMEOUT_MS = 300_000;

type Arm = 'rubric' | 'control';
const PROMPT_VERSION: Record<Arm, string> = { rubric: U3_PROMPT_VERSION, control: 'c4-v0.2' };

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

export function ledgerCount(): number {
  return fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').length : 0;
}

/** Minimal check against INTERPRETATION_SCHEMA: required keys, enums, types. Null when valid, else the reason. */
export function schemaProblem(v: unknown): string | null {
  if (typeof v !== 'object' || v === null) return 'not an object';
  const a = v as Record<string, unknown>;
  for (const k of INTERPRETATION_SCHEMA.required) if (!(k in a)) return `missing ${k}`;
  const extra = Object.keys(a).filter((k) => !(INTERPRETATION_SCHEMA.required as readonly string[]).includes(k));
  if (extra.length > 0) return `extra keys ${extra.join(',')}`;
  if (typeof a['explanation'] !== 'string') return 'explanation';
  const im = a['intentMatch'] as Record<string, unknown> | null;
  if (typeof im !== 'object' || im === null || !(INTENT_STATUSES as readonly unknown[]).includes(im['status']) || !Array.isArray(im['cites'])) return 'intentMatch';
  if (!(SEVERITY_CLASSES as readonly unknown[]).includes(a['severityClass'])) return 'severityClass';
  if (!Array.isArray(a['cites']) || !(a['cites'] as unknown[]).every((c) => typeof c === 'string')) return 'cites';
  const ec = a['exceptionClaim'] as Record<string, unknown> | null;
  if (typeof ec !== 'object' || ec === null || typeof ec['claimed'] !== 'boolean') return 'exceptionClaim';
  const c = ec['citation'] as Record<string, unknown> | null;
  if (c !== null && (typeof c !== 'object' || typeof c['path'] !== 'string' || typeof c['quote'] !== 'string' || !Number.isInteger(c['startLine']) || !Number.isInteger(c['endLine']))) return 'exceptionClaim.citation';
  if (ec['scope'] !== null && typeof ec['scope'] !== 'string') return 'exceptionClaim.scope';
  return null;
}

interface CliResult { readonly answer: unknown; readonly model: string | null; readonly durationMs: number; readonly error: string | null; readonly costUsd: number | null }

/** One `claude -p` call: prompt on stdin, the frozen schema and system prompt, no tools, run from an empty directory. */
function callClaude(system: string, prompt: string): Promise<CliResult> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-u3-'));
  const args = ['-p', '--model', MODEL, '--output-format', 'json', '--json-schema', JSON.stringify(INTERPRETATION_SCHEMA),
    '--system-prompt', system, '--setting-sources', 'project', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools', ''];
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.rmSync(cwd, { recursive: true, force: true });
      const durationMs = Date.now() - t0;
      let env: Record<string, unknown> | null = null;
      try { env = JSON.parse(stdout) as Record<string, unknown>; } catch { env = null; }
      if (env === null) { resolve({ answer: null, model: null, durationMs, error: `exit ${String(code)}; no JSON envelope; ${stderr.slice(0, 300)}`, costUsd: null }); return; }
      const usage = env['modelUsage'] as Record<string, unknown> | undefined;
      const model = usage !== undefined ? Object.keys(usage).sort().join('+') : null;
      const costUsd = typeof env['total_cost_usd'] === 'number' ? env['total_cost_usd'] : null;
      if (env['is_error'] === true || code !== 0) { resolve({ answer: null, model, durationMs, error: `exit ${String(code)}; ${String(env['result'] ?? '').slice(0, 300)}`, costUsd }); return; }
      let answer: unknown = env['structured_output'];
      if (answer === undefined && typeof env['result'] === 'string') {
        try { answer = JSON.parse(env['result']); } catch { answer = null; }
      }
      resolve({ answer: answer ?? null, model, durationMs, error: null, costUsd });
    });
    child.stdin.end(prompt);
  });
}

interface Cassette {
  readonly arm: Arm;
  readonly project: string;
  readonly findingId: string;
  readonly runIndex: number;
  readonly promptVersion: string;
  readonly promptHash: string;
  readonly systemHash: string;
  readonly model: string | null;
  readonly date: string;
  readonly answer: C4Answer;
}

function cassettePath(arm: Arm, project: string, findingId: string, runIndex: number): string {
  return path.join(HERE, 'cassettes', arm, project, `${sha256Hex(findingId).slice(0, 16)}-r${String(runIndex)}.json`);
}

export interface PilotOptions {
  readonly arm: Arm;
  readonly mode: 'estimate' | 'record' | 'replay';
  readonly runs: number;
  readonly cap: number;
}

export interface ProjectOutcome {
  readonly target: C4Target;
  readonly item: PreparedItem | null;
  readonly entry: A5Entry | null;
  readonly score: C4CaseScore | null;
}

/** Interprets the target finding of one project; returns its A5 entry and score. */
async function runProject(t: C4Target, o: PilotOptions, state: { calls: number; stopped: string | null }): Promise<ProjectOutcome> {
  const p = await prepareC4Project(t);
  const m = t.manifest;
  if (m === null) throw new Error(`${t.id}: no manifest`);
  const item = targetEntry(m, p.items.map((i) => ({ ...i, finding: i.context.finding })));
  if (item === undefined) {
    out(`${t.id}: TARGET NOT PRODUCED (findings: ${p.findings.map((f) => `${f.rule} ${f.files[0] ?? ''}`).join('; ') || 'none'})`);
    return { target: t, item: null, entry: null, score: null };
  }
  const prompt = o.arm === 'rubric' ? rubricPrompt(item.context) : controlPrompt(item.context);
  const promptHash = sha256Hex(prompt);
  const systemHash = sha256Hex(INTERPRETATION_SYSTEM);
  const runs: C4Run[] = [];
  for (let r = 0; r < o.runs; r++) {
    const cp = cassettePath(o.arm, t.id, item.context.finding.id, r);
    const cached = fs.existsSync(cp) ? JSON.parse(fs.readFileSync(cp, 'utf8')) as Cassette : null;
    const hit = cached !== null && cached.promptHash === promptHash && cached.systemHash === systemHash ? cached : null;
    if (o.mode === 'estimate') {
      if (hit === null) state.calls++;
      continue;
    }
    if (hit !== null) {
      runs.push({ runIndex: r, grounded: groundC4Answer(hit.answer, item.docs, item.read), modelId: hit.model, promptHash, date: hit.date, invalidReason: null });
      continue;
    }
    if (o.mode === 'replay' || state.stopped !== null) {
      runs.push({ runIndex: r, grounded: null, modelId: null, promptHash, date: null, invalidReason: o.mode === 'replay' ? 'cassette-miss' : 'stopped' });
      continue;
    }
    let answer: C4Answer | null = null;
    let reason: string | null = null;
    let model: string | null = null;
    for (let attempt = 0; attempt < 2 && answer === null; attempt++) {
      const used = ledgerCount();
      if (used >= Math.min(o.cap, HARD_CAP)) {
        state.stopped = `cap reached (${String(used)} of ${String(Math.min(o.cap, HARD_CAP))})`;
        reason = 'cap';
        break;
      }
      const res = await callClaude(INTERPRETATION_SYSTEM, prompt);
      const problem = res.error ?? schemaProblem(res.answer);
      model = res.model;
      fs.appendFileSync(LEDGER, `${JSON.stringify({
        n: used + 1, at: new Date().toISOString(), arm: o.arm, project: t.id, rule: item.context.finding.rule, run: r, attempt,
        model: res.model, requestedModel: MODEL, promptVersion: PROMPT_VERSION[o.arm], promptHash: promptHash.slice(0, 16),
        durationMs: res.durationMs, ok: problem === null, problem,
      })}\n`);
      state.calls++;
      if (problem === null) answer = res.answer as C4Answer;
      else reason = problem;
    }
    if (answer === null) {
      runs.push({ runIndex: r, grounded: null, modelId: model, promptHash, date: null, invalidReason: reason });
      continue;
    }
    const date = new Date().toISOString();
    const c: Cassette = { arm: o.arm, project: t.id, findingId: item.context.finding.id, runIndex: r, promptVersion: PROMPT_VERSION[o.arm], promptHash, systemHash, model, date, answer };
    fs.mkdirSync(path.dirname(cp), { recursive: true });
    fs.writeFileSync(cp, `${JSON.stringify(c, null, 2)}\n`);
    runs.push({ runIndex: r, grounded: groundC4Answer(answer, item.docs, item.read), modelId: model, promptHash, date, invalidReason: null });
  }
  if (o.mode === 'estimate') return { target: t, item, entry: null, score: null };
  const entry = a5Entry(item.context.finding, PROMPT_VERSION[o.arm], runs);
  const score = scoreC4Case(m, [entry], baselineOf([item]));
  return { target: t, item, entry, score };
}

export async function runPilot(targets: readonly C4Target[], o: PilotOptions): Promise<{ outcomes: ProjectOutcome[]; calls: number; stopped: string | null }> {
  const state = { calls: 0, stopped: null as string | null };
  const outcomes: ProjectOutcome[] = [];
  for (const t of targets) outcomes.push(await runProject(t, o, state));
  return { outcomes, calls: state.calls, stopped: state.stopped };
}

export function targetsOf(set: string, only?: readonly string[]): C4Target[] {
  const files = set === 'all' ? [SETS.original, SETS.new] : [SETS[set as keyof typeof SETS]];
  if (files.some((f) => f === undefined)) throw new Error(`unknown --set ${set}`);
  return files.flatMap((f) => setTargets(f, only !== undefined ? { only } : {}));
}

async function main(argv: readonly string[]): Promise<number> {
  const arm = (arg(argv, '--arm') ?? 'rubric') as Arm;
  if (arm !== 'rubric' && arm !== 'control') { out('--arm rubric|control'); return 2; }
  const mode = argv.includes('--record') ? 'record' : argv.includes('--replay') ? 'replay' : 'estimate';
  const cap = Number(arg(argv, '--cap') ?? String(HARD_CAP));
  const only = arg(argv, '--only')?.split(',');
  const targets = targetsOf(arg(argv, '--set') ?? 'all', only);
  const before = ledgerCount();
  const res = await runPilot(targets, { arm, mode, runs: Number(arg(argv, '--runs') ?? '2'), cap });
  if (mode === 'estimate') {
    out(`${arm}: ${String(targets.length)} projects; uncached calls ${String(res.calls)}; ledger ${String(before)}; after this run at most ${String(before + res.calls)} (+ one schema retry each) of the hard cap ${String(HARD_CAP)}`);
    return 0;
  }
  const dir = path.join(HERE, 'results', arm);
  fs.mkdirSync(dir, { recursive: true });
  for (const x of res.outcomes) {
    if (x.entry === null) continue;
    fs.mkdirSync(path.join(dir, x.target.id), { recursive: true });
    fs.writeFileSync(path.join(dir, x.target.id, 'interpretation.json'), `${JSON.stringify({ arm, promptVersion: PROMPT_VERSION[arm], requestedModel: MODEL, entry: x.entry }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, x.target.id, 'score.json'), `${JSON.stringify(x.score, null, 2)}\n`);
  }
  out('| Project | Role | Severity (r0, r1) | Allowed | Exception | Intent | Correct | Clean |');
  out('|---|---|---|---|---|---|---|---|');
  for (const x of res.outcomes) {
    const runs = x.entry?.runs ?? [];
    const f = (g: (a: C4Answer) => string): string => runs.map((r) => (r.grounded === null ? `invalid(${r.invalidReason ?? ''})` : g(r.grounded.answer))).join(', ');
    out(`| ${x.target.id} | ${x.target.manifest?.role ?? ''} | ${f((a) => a.severityClass)} | ${x.target.manifest?.expected.severityAllowed.join('/') ?? ''} | ${f((a) => String(a.exceptionClaim.claimed))} | ${f((a) => a.intentMatch.status)} | ${String(x.score?.correct ?? null)} | ${String(x.score?.clean ?? null)} |`);
  }
  out('');
  out(`provider calls this run ${String(res.calls)}; ledger total ${String(ledgerCount())} of ${String(HARD_CAP)}${res.stopped !== null ? `; STOPPED: ${res.stopped}` : ''}`);
  return res.stopped !== null ? 4 : 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]).endsWith(path.join('v15-u3', 'run.ts'))) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
