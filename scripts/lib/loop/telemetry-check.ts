/**
 * Loop telemetry completeness check (readiness gate D6; `Docs/v1.3/study2-readiness-gate.md` "D6", the MCP call log
 * of `Docs/v1.3/mcp-call-log.md`). Pure reading of a loop out-root; no model call, no Neo4j, nothing written.
 *
 * For every run (`<outRoot>/runs/**\/run.json`) and every step record it checks:
 * - the step record exists, its turns are non-empty and the step has `startedAt` ≤ `finishedAt`;
 * - per turn: non-null tokens (input, output, cache read, cache creation), `costUsd`, `numTurns`; a numeric `wallMs`;
 *   at least one attempt; every interruption carries its pause (`pause`, gate S1); the prompt text beside the
 *   envelope (`turns/step-NN/prompt-<turnId>.txt`) exists and hashes to the recorded `promptSha256`;
 * - gate arm: `repair` is non-null; when the repair ran and both snapshots were evaluated, `repairOutcome` is present;
 * - `daedalus-mcp` arm: the run was created with the call log (`callLog: true`), the step has its `process` block,
 *   every turn has its call log (`calls/<turnId>.jsonl`, under the run directory, outside `work/`), every line is a
 *   well-formed `mcp-call/v1` line, its tool is one of the arm's allowed tools (`DAEDALUS_ARM_TOOLS`) and never a
 *   denied one (`DAEDALUS_DENIED_TOOLS`), its `ts` lies inside the step's window, and the `process.calls` count equals
 *   the number of lines.
 *
 * Not checked here (needs a live CLI): "one call-log line per tool call reported by the CLI envelope". The scrubbed
 * envelope does not carry a tool-call list the harness reads today; the S4 probes with the server attached are where
 * that is first observable.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DAEDALUS_ARM_TOOLS, DAEDALUS_DENIED_TOOLS } from '../generators/arms.js';
import type { RunRecord, StepRecord, TurnRecord } from './types.js';

export const TELEMETRY_SCHEMA = 'loop-telemetry-check/v1';

export interface TelemetryProblem {
  readonly runId: string;
  /** `step-NN`, or null for a run-level problem. */
  readonly step: string | null;
  readonly turnId: string | null;
  readonly problem: string;
}

export interface TelemetryReport {
  readonly schema: typeof TELEMETRY_SCHEMA;
  readonly runs: number;
  readonly steps: number;
  readonly turns: number;
  readonly mcpCalls: number;
  readonly problems: readonly TelemetryProblem[];
  readonly ok: boolean;
}

const USAGE_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheCreationTokens', 'costUsd', 'numTurns'] as const;
const SHA256_RE = /^[0-9a-f]{64}$/;
const pad = (n: number): string => String(n).padStart(2, '0');

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/** Every `run.json` under `<outRoot>/runs`, as run directories, sorted. */
export function findRunDirs(outRoot: string): string[] {
  const root = path.join(outRoot, 'runs');
  const out: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    const names = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    if (names.some((e) => e.isFile() && e.name === 'run.json')) {
      out.push(dir);
      return;
    }
    for (const e of names) if (e.isDirectory()) walk(path.join(dir, e.name));
  };
  walk(root);
  return out;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Problems of one `mcp-call/v1` line (empty when well-formed). */
export function callLineProblems(raw: string, window: { readonly startMs: number; readonly endMs: number }): string[] {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return ['call-log line is not JSON'];
  }
  if (!isObj(v) || v.schema !== 'mcp-call/v1') return ['call-log line is not mcp-call/v1'];
  const p: string[] = [];
  if (typeof v.tool !== 'string') p.push('call-log line has no tool');
  else if (DAEDALUS_DENIED_TOOLS.includes(v.tool)) p.push(`denied tool ${v.tool} was called`);
  else if (!DAEDALUS_ARM_TOOLS.includes(v.tool)) p.push(`tool ${v.tool} is not an allowed arm tool`);
  if (!Number.isInteger(v.seq) || (v.seq as number) < 1) p.push('call-log seq must be a positive integer');
  if (typeof v.argsSha256 !== 'string' || v.argsSha256 === '') p.push('call-log argsSha256 missing');
  if (typeof v.durationMs !== 'number' || v.durationMs < 0) p.push('call-log durationMs missing');
  if (!Array.isArray(v.filesTouched)) p.push('call-log filesTouched missing');
  if (!('treeChangedSinceStart' in v) || !(v.treeChangedSinceStart === null || typeof v.treeChangedSinceStart === 'boolean')) {
    p.push('call-log treeChangedSinceStart missing (before/after first write)');
  }
  const ts = typeof v.ts === 'string' ? Date.parse(v.ts) : Number.NaN;
  if (Number.isNaN(ts)) p.push('call-log ts is not a date');
  else if (ts < window.startMs || ts > window.endMs) p.push(`call-log ts ${String(v.ts)} lies outside the step window`);
  return p;
}

function turnProblems(runDir: string, stepIndex: number, t: TurnRecord): string[] {
  const p: string[] = [];
  const r = t.result as Partial<TurnRecord['result']> | undefined;
  const usage = (r?.usage ?? {}) as Record<string, unknown>;
  for (const f of USAGE_FIELDS) if (typeof usage[f] !== 'number') p.push(`usage.${f} is null`);
  if (typeof r?.wallMs !== 'number') p.push('wallMs missing');
  if (!Array.isArray(r?.attempts) || r.attempts.length === 0) p.push('no attempt recorded');
  for (const [i, it] of (r?.interruptions ?? []).entries()) if (it.pause === undefined) p.push(`interruption ${String(i)} has no pause duration (S1)`);
  if (typeof t.promptSha256 !== 'string' || !SHA256_RE.test(t.promptSha256)) p.push('promptSha256 missing');
  const promptFile = path.join(runDir, 'turns', `step-${pad(stepIndex + 1)}`, `prompt-${t.turnId}.txt`);
  if (!fs.existsSync(promptFile)) p.push('prompt text missing');
  else if (createHash('sha256').update(fs.readFileSync(promptFile, 'utf8'), 'utf8').digest('hex') !== t.promptSha256) p.push('prompt text does not hash to promptSha256');
  return p;
}

export interface TelemetryOptions {
  /** Runs that are still in progress are skipped instead of reported (default false: an incomplete run is a problem). */
  readonly allowIncomplete?: boolean;
}

export function checkTelemetry(outRoot: string, options: TelemetryOptions = {}): TelemetryReport {
  const problems: TelemetryProblem[] = [];
  let steps = 0;
  let turns = 0;
  let mcpCalls = 0;
  const runDirs = findRunDirs(outRoot);
  for (const runDir of runDirs) {
    const raw = readJson(path.join(runDir, 'run.json'));
    const run = isObj(raw) && raw.schema === 'loop-run/v1' ? (raw as unknown as RunRecord) : null;
    const runId = run?.runId ?? path.relative(outRoot, runDir).split(path.sep).join('/');
    const add = (step: string | null, turnId: string | null, problem: string): void => {
      problems.push({ runId, step, turnId, problem });
    };
    if (run === null) {
      add(null, null, 'run.json unreadable or not loop-run/v1');
      continue;
    }
    if (run.completedAt === undefined) {
      if (options.allowIncomplete !== true) add(null, null, 'run not completed');
      continue;
    }
    const arm = run.spec.arm;
    if (arm === 'daedalus-mcp' && run.callLog !== true) add(null, null, 'daedalus-mcp run was not created with the call log (--call-log)');
    for (let i = 0; i < run.steps; i++) {
      const step = `step-${pad(i + 1)}`;
      const rawStep = readJson(path.join(runDir, 'steps', `${step}.json`));
      const rec = isObj(rawStep) && rawStep.schema === 'loop-step/v1' && Array.isArray(rawStep.turns) ? (rawStep as unknown as StepRecord) : null;
      if (rec === null) {
        add(step, null, 'step record missing or not loop-step/v1');
        continue;
      }
      steps++;
      const startMs = Date.parse(rec.startedAt);
      const endMs = Date.parse(rec.finishedAt);
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) add(step, null, 'startedAt/finishedAt missing or out of order');
      if (rec.turns.length === 0) add(step, null, 'no turn recorded');
      for (const t of rec.turns) {
        turns++;
        for (const p of turnProblems(runDir, i, t)) add(step, t.turnId, p);
      }
      if (arm === 'gate') {
        if (rec.repair === null) add(step, null, 'gate step has no repair block');
        else if (rec.repair.attempted && rec.repair.skipped === undefined && rec.repair.blockingBefore !== null && rec.repair.blockingAfter !== null && rec.repairOutcome === undefined) {
          add(step, null, 'gate step repaired but has no repairOutcome');
        }
      }
      if (arm !== 'daedalus-mcp') continue;
      if (rec.process === undefined) add(step, null, 'daedalus-mcp step has no process block');
      let lines = 0;
      for (const t of rec.turns) {
        const log = path.join(runDir, 'calls', `${t.turnId}.jsonl`);
        if (!fs.existsSync(log)) {
          add(step, t.turnId, 'call log missing');
          continue;
        }
        const raw = fs.readFileSync(log, 'utf8').split('\n').filter((l) => l.trim() !== '');
        lines += raw.length;
        for (const [n, l] of raw.entries()) for (const p of callLineProblems(l, { startMs, endMs })) add(step, t.turnId, `line ${String(n + 1)}: ${p}`);
      }
      mcpCalls += lines;
      if (rec.process !== undefined && rec.process.calls !== lines) add(step, null, `process.calls ${String(rec.process.calls)} differs from the ${String(lines)} call-log lines`);
    }
  }
  if (runDirs.length === 0) problems.push({ runId: '', step: null, turnId: null, problem: `no run under ${path.join(outRoot, 'runs')}` });
  return { schema: TELEMETRY_SCHEMA, runs: runDirs.length, steps, turns, mcpCalls, problems, ok: problems.length === 0 };
}
