/**
 * Per-step process metrics of the `daedalus-mcp` arm from the MCP call logs (gate line D6, Docs/v1.3/mcp-call-log.md).
 *
 * Each turn of a run with the call log on has its own log, `<runDir>/calls/<turnId>.jsonl` (outside `work/`), which
 * the MCP server appends one `mcp-call/v1` line to per tool call. The step record's `process` block sums the step's
 * turns: calls per tool, errors, nearest-rank p50/p95 latency, and whether the first call came before the first write.
 *
 * First call vs first write: the server fingerprints the project when it starts (with the CLI session, before the
 * agent acts) and records on every call whether the tree changed since (`treeChangedSinceStart`). That decides it.
 * When the field is null, the earliest mtime among the files the turn left changed is an upper bound on the first
 * write: a first call later than it is certainly after a write; anything else stays undetermined (null).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StepProcess } from './types.js';

export const CALLS_DIR = 'calls';

/** `<runDir>/calls/<turnId>.jsonl`. */
export function callLogPathFor(runDir: string, turnId: string): string {
  return path.join(runDir, CALLS_DIR, `${turnId}.jsonl`);
}

/** The fields of an `mcp-call/v1` line the metrics read (call-log.ts writes them). */
export interface CallLine {
  readonly ts: string;
  readonly tool: string;
  readonly durationMs: number;
  readonly error: string | null;
  readonly treeChangedSinceStart: boolean | null;
}

function isCallLine(v: unknown): v is CallLine {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.schema === 'mcp-call/v1' && typeof o.ts === 'string' && typeof o.tool === 'string' && typeof o.durationMs === 'number';
}

/** The call lines of a log, in file order; null when the file does not exist. Unreadable lines are skipped. */
export function readCallLog(file: string): readonly CallLine[] | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const out: CallLine[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const v = JSON.parse(line) as unknown;
      if (isCallLine(v)) out.push({ ts: v.ts, tool: v.tool, durationMs: v.durationMs, error: v.error ?? null, treeChangedSinceStart: v.treeChangedSinceStart ?? null });
    } catch {
      // a torn last line (the server was killed mid-write): ignored
    }
  }
  return out;
}

/** Nearest-rank percentile (p in 0..100) of the values; null when there are none. */
export function nearestRank(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? null;
}

/** Earliest mtime (ms) among files under `root` modified at or after `sinceMs`, skipping node_modules and .git. */
export function earliestWriteSince(root: string, sinceMs: number): number | null {
  let best: number | null = null;
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        const m = fs.statSync(full).mtimeMs;
        if (m >= sinceMs && (best === null || m < best)) best = m;
      }
    }
  };
  walk(root);
  return best;
}

/** One turn of the step, as the loop saw it. */
export interface TurnCallLog {
  readonly logPath: string;
  /** Upper bound on the turn's first write (earliest mtime of a file it changed); null when unknown or none. */
  readonly firstWriteBoundMs: number | null;
}

/** The step's `process` block from its turns' logs (in turn order). */
export function stepProcess(runDir: string, turns: readonly TurnCallLog[]): StepProcess {
  const logs: string[] = [];
  const calls: CallLine[] = [];
  let firstTurn: { readonly call: CallLine; readonly bound: number | null } | null = null;
  for (const t of turns) {
    const lines = readCallLog(t.logPath);
    if (lines === null) continue;
    logs.push(path.relative(runDir, t.logPath).split(path.sep).join('/'));
    const first = lines[0];
    if (firstTurn === null && first !== undefined) firstTurn = { call: first, bound: t.firstWriteBoundMs };
    calls.push(...lines);
  }
  const byTool: Record<string, number> = {};
  for (const c of [...calls].sort((a, b) => (a.tool < b.tool ? -1 : a.tool > b.tool ? 1 : 0))) byTool[c.tool] = (byTool[c.tool] ?? 0) + 1;
  let before: boolean | null = null;
  let evidence: StepProcess['firstWriteEvidence'] = 'none';
  if (firstTurn !== null) {
    if (firstTurn.call.treeChangedSinceStart !== null) {
      before = !firstTurn.call.treeChangedSinceStart;
      evidence = 'server-fingerprint';
    } else if (firstTurn.bound !== null) {
      evidence = 'mtime-upper-bound';
      before = Date.parse(firstTurn.call.ts) > firstTurn.bound ? false : null;
    }
  }
  const durations = calls.map((c) => c.durationMs);
  return {
    schema: 'loop-process/v1',
    logs,
    logFound: logs.length > 0,
    calls: calls.length,
    errors: calls.filter((c) => c.error !== null).length,
    callsByTool: byTool,
    firstCallAt: firstTurn?.call.ts ?? null,
    firstCallBeforeFirstWrite: before,
    firstWriteEvidence: evidence,
    latencyMs: { p50: nearestRank(durations, 50), p95: nearestRank(durations, 95) },
  };
}
