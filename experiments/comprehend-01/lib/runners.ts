/**
 * COMPREHEND-01 session runners. `FakeModelRunner` is a scripted fake model for the dry run: it never spawns a
 * process and writes stream-json in the shape the EFF-01 transcript reader parses (init, assistant messages with
 * tool_use and text, a result envelope with `modelUsage`). `LiveRunner` spawns the Claude Code CLI and exists for the
 * pilot only: it refuses to start unless the live guard is passed (run.ts). Zero model calls in this build.
 */
import { spawn } from 'node:child_process';
import { isolatedClaudeEnv } from '../../../scripts/lib/loop/isolation.js';
import { COMPREHEND_SERVER_NAME } from '../../detect-02/mcp/comprehend-server.js';
import type { Arm } from './arms.js';
import { MODEL } from './arms.js';

export interface SessionRequest {
  readonly sessionId: string; readonly arm: Arm | 'calibration-F' | 'calibration-FG'; readonly args: readonly string[];
  readonly cwd: string; readonly timeoutMs: number; readonly attempt: number;
}
export interface SessionOutput { readonly stdout: string; readonly exitCode: number; readonly ms: number; readonly timedOut: boolean }
export interface SessionRunner { readonly kind: 'fake' | 'live'; run(req: SessionRequest): Promise<SessionOutput> }

// ── Fake model ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type FakeBehaviour = 'answer' | 'wrong' | 'no-answer' | 'no-graph' | 'leak-outside-tree' | 'leak-mcp-in-F' | 'over-turns';
export interface FakeScript {
  /** What the fake answers (an answer object), and how it behaves, per session id and attempt. */
  answerFor(sessionId: string): Record<string, unknown> | null;
  behaviourFor(sessionId: string, attempt: number): FakeBehaviour;
  /** Graph tools the fake calls in FG (tool name and input), in order. */
  graphCallsFor(sessionId: string): readonly { name: string; input: Record<string, unknown> }[];
  /** File reads the fake makes (project-relative). */
  readsFor(sessionId: string): readonly string[];
  /** Deterministic token usage of the session (fake numbers, for the ledger plumbing only). */
  usageFor(sessionId: string): { input: number; cacheCreation: number; cacheRead: number; output: number };
}

export class FakeModelRunner implements SessionRunner {
  readonly kind = 'fake' as const;
  readonly spawned: string[] = [];
  constructor(private readonly script: FakeScript) {}

  async run(req: SessionRequest): Promise<SessionOutput> {
    this.spawned.push(`${req.sessionId}#${req.attempt}`);
    const fg = req.arm === 'FG' || req.arm === 'calibration-FG';
    const isCal = req.arm.startsWith('calibration');
    const b = isCal ? 'answer' : this.script.behaviourFor(req.sessionId, req.attempt);
    const u = this.script.usageFor(req.sessionId);
    const lines: unknown[] = [];
    const tools = ['Read', 'Grep', 'Glob', ...(fg ? ['context_map', 'who_writes', 'trace', 'impact'].map((t) => `mcp__${COMPREHEND_SERVER_NAME}__${t}`) : [])];
    lines.push({ type: 'system', subtype: 'init', model: MODEL, tools, mcp_servers: fg ? [{ name: COMPREHEND_SERVER_NAME, status: 'connected' }] : [] });
    let n = 0;
    const msg = (content: unknown[], share: number): void => {
      n++;
      lines.push({ type: 'assistant', message: { id: `msg_${req.sessionId}_${n}`, model: MODEL, content, usage: {
        input_tokens: Math.round(u.input * share), cache_creation_input_tokens: Math.round(u.cacheCreation * share), cache_read_input_tokens: Math.round(u.cacheRead * share), output_tokens: Math.round(u.output * share) } } });
    };
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    if (!isCal) {
      for (const f of this.script.readsFor(req.sessionId)) calls.push({ name: 'Read', input: { file_path: `${req.cwd}/${f}` } });
      if (fg && b !== 'no-graph') calls.push(...this.script.graphCallsFor(req.sessionId).map((c) => ({ name: `mcp__${COMPREHEND_SERVER_NAME}__${c.name}`, input: c.input })));
      if (b === 'leak-outside-tree') calls.push({ name: 'Read', input: { file_path: '/etc/hostname' } });
      if (b === 'leak-mcp-in-F') calls.push({ name: `mcp__${COMPREHEND_SERVER_NAME}__context_map`, input: {} });
    }
    const turns = b === 'over-turns' ? 31 : calls.length + 1;
    const shares = calls.length + 1;
    calls.forEach((c, i) => msg([{ type: 'tool_use', id: `tu_${i}`, name: c.name, input: c.input }], 1 / shares));
    const answer = this.script.answerFor(req.sessionId);
    const text = isCal ? 'OK'
      : b === 'no-answer' ? 'I looked at the code but I am not sure.'
      : `Based on the evidence above.\nANSWER: ${JSON.stringify(b === 'wrong' ? perturb(answer) : answer ?? {})}`;
    msg([{ type: 'text', text }], 1 / shares);
    lines.push({
      type: 'result', subtype: b === 'over-turns' ? 'error_max_turns' : 'success', is_error: b === 'over-turns', num_turns: turns, duration_ms: 1000 + 250 * calls.length, result: text,
      modelUsage: { [MODEL]: { inputTokens: u.input, cacheCreationInputTokens: u.cacheCreation, cacheReadInputTokens: u.cacheRead, outputTokens: u.output } },
      usage: { input_tokens: u.input, cache_creation_input_tokens: u.cacheCreation, cache_read_input_tokens: u.cacheRead, output_tokens: u.output },
    });
    return { stdout: `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, exitCode: b === 'over-turns' ? 1 : 0, ms: 1, timedOut: false };
  }
}

/** A wrong answer of the same shape: a set loses its first element (or gains one), a string changes. */
export function perturb(a: Record<string, unknown> | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a ?? {})) {
    if (Array.isArray(v)) out[k] = v.length > 1 ? v.slice(1) : [...v, 'Unrelated'];
    else if (typeof v === 'string') out[k] = v.includes('/') ? 'src/unrelated/' : `${v}-x`;
    else out[k] = v;
  }
  return out;
}

// ── Live runner (pilot only; never constructed by the dry run) ──────────────────────────────────────────────────────

export class LiveRunner implements SessionRunner {
  readonly kind = 'live' as const;
  constructor(private readonly claudeBinary: string, private readonly configDir: string, private readonly home: string) {}

  run(req: SessionRequest): Promise<SessionOutput> {
    const t0 = Date.now();
    return new Promise((resolve) => {
      const child = spawn(this.claudeBinary, [...req.args], { cwd: req.cwd, env: isolatedClaudeEnv(process.env, this.home, { configDir: this.configDir }), stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let timedOut = false;
      child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8'); });
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, req.timeoutMs);
      child.on('close', (code) => { clearTimeout(timer); resolve({ stdout: out, exitCode: code ?? 1, ms: Date.now() - t0, timedOut }); });
    });
  }
}
