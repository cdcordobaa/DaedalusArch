/**
 * Checks of a loop replay (`replay.ts`), shared by `scripts/loop-replay-cli.ts` and the jest integration test:
 * - gate exactness: the gate's repair turn ran on exactly the steps the tapes script as violating;
 * - consistency: every snapshot's recorded evaluation equals a full `evaluate_project` of the same commit, checked
 *   out afresh (timing field aside);
 * - MCP feedback: what `check_diff` / `check_file` reported after each `daedalus-mcp` step, against the blocking
 *   findings of the full evaluation of the same tree (the `none` arm's snapshot of that step);
 * - labelling: every new blocking finding (memo §3) through `scripts/v1.3/check-correct.ts`'s checker, read from the
 *   report the loop wrote beside the turn;
 * - reproducibility: two replays give byte-identical outputs once the listed timing fields are set to 0;
 * - latency: per step, from the records and the `timing-*.json` files.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { buildHarnessTsconfig } from '../generators/harness-tsconfig.js';
import { checkFinding } from '../../v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../../v1.3/lib/labelling/findings.js';
import { SourceFactsCache } from '../../v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../../v1.3/lib/labelling/spec-facts.js';
import { SNAPSHOT_GIT_DIR } from './snapshot.js';
import { STEPS_DIR, TURNS_DIR } from './loop.js';
import { findingIdentity, runOutcomes, unmatchedShare } from './pilot-metrics.js';
import type { RunOutcomes } from './pilot-metrics.js';
import { checkoutCommit, evaluationContent, readRunSteps } from './replay.js';
import type { ReplayEnvelope, ReplayResult, ReplayTape, ReplayTiming } from './replay.js';
import type { StepRecord } from './types.js';

/** JSON keys that hold measured time; a reproducibility comparison sets them to 0 (and only them). */
export const TIMING_KEYS: readonly string[] = Object.freeze(['durationMs', 'wallMs', 'turnMs', 'ms']);
/** Files that only hold measured time. */
export const TIMING_FILE = /(^|\/)timing-[^/]+\.json$/;

export interface GateCheck {
  readonly runId: string;
  readonly scripted: readonly number[];
  readonly repaired: readonly number[];
  readonly exact: boolean;
}

export function gateExactness(result: ReplayResult, tapes: readonly ReplayTape[]): GateCheck[] {
  const out: GateCheck[] = [];
  for (const run of result.runs.filter((r) => r.spec.arm === 'gate')) {
    const tape = tapes.find((t) => t.taskId === run.spec.taskId);
    const scripted = (tape?.steps ?? []).flatMap((s, i) => (s.violating !== undefined ? [i + 1] : []));
    const repaired = readRunSteps(run.runDir, tape?.steps.length ?? 0).flatMap((s) => (s.repair?.attempted === true ? [s.stepIndex + 1] : []));
    out.push({ runId: run.runId, scripted, repaired, exact: JSON.stringify(scripted) === JSON.stringify(repaired) });
  }
  return out;
}

export interface ConsistencyRow {
  readonly runId: string;
  readonly step: number;
  readonly turnId: string;
  readonly commit: string;
  readonly equal: boolean;
  readonly recordedBlocking: number | null;
  readonly fullBlocking: number | null;
  /** Wall time of the full re-evaluation (ms). */
  readonly fullEvaluationMs: number;
  readonly difference?: string;
}

function specFileOf(repoRoot: string, runDir: string, step: StepRecord): string {
  const ref = step.evaluatorSpec;
  if (ref === undefined) throw new Error(`${step.runId}: step ${String(step.stepIndex + 1)} names no spec`);
  return ref.kind === 'static' ? path.resolve(repoRoot, ref.path) : path.join(runDir, ...ref.path.split('/'));
}

/** Re-evaluates every snapshot of every run from a fresh checkout of its commit and compares. */
export async function consistency(result: ReplayResult, repoRoot: string, scratch: string, steps: number): Promise<ConsistencyRow[]> {
  const rows: ConsistencyRow[] = [];
  let n = 0;
  for (const run of result.runs) {
    for (const s of readRunSteps(run.runDir, steps)) {
      const specFile = specFileOf(repoRoot, run.runDir, s);
      for (const t of s.turns) {
        const dir = path.join(scratch, `checkout-${String(n++)}`);
        checkoutCommit(path.join(run.runDir, SNAPSHOT_GIT_DIR), t.snapshot.commit, path.join(dir, 'project'));
        const tsconfig = path.join(dir, 'tsconfig.json');
        fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(path.join(dir, 'project')), null, 2)}\n`);
        const t0 = performance.now();
        const full = await result.evaluatorOf(specFile, tsconfig).evaluate(path.join(dir, 'project'));
        const ms = performance.now() - t0;
        const recorded = JSON.stringify(evaluationContent(t.snapshot.evaluation));
        let fresh = 'null';
        if (full.success) {
          const { reportViolations: _r, ...rest } = full.data;
          fresh = JSON.stringify(evaluationContent(rest));
        }
        const equal = recorded === fresh;
        rows.push({
          runId: run.runId,
          step: s.stepIndex + 1,
          turnId: t.turnId,
          commit: t.snapshot.commit,
          equal,
          recordedBlocking: t.snapshot.evaluation?.blockingViolationCount ?? null,
          fullBlocking: full.success ? full.data.blockingViolationCount : null,
          fullEvaluationMs: Math.round(ms),
          ...(equal ? {} : { difference: `recorded ${recorded.slice(0, 400)} / full ${full.success ? fresh.slice(0, 400) : JSON.stringify(full.errors)}` }),
        });
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  return rows;
}

export interface McpFeedbackRow {
  readonly taskId: string;
  readonly step: number;
  /** `(rule, file)` pairs the tools reported after the step's edits. */
  readonly toolReported: readonly string[];
  /** `(rule, file)` pairs of the full evaluation's blocking findings on the same tree (`none` arm, same step). */
  readonly fullBlocking: readonly string[];
  readonly scriptedViolation: boolean;
  readonly fixApplied: boolean;
  readonly unfollowed: boolean;
  readonly toolErrors: readonly string[];
}

export function mcpFeedback(result: ReplayResult, tapes: readonly ReplayTape[]): McpFeedbackRow[] {
  const rows: McpFeedbackRow[] = [];
  for (const run of result.runs.filter((r) => r.spec.arm === 'daedalus-mcp')) {
    const tape = tapes.find((t) => t.taskId === run.spec.taskId);
    const none = result.runs.find((r) => r.spec.taskId === run.spec.taskId && r.spec.arm === 'none');
    if (tape === undefined || none === undefined) continue;
    const noneSteps = readRunSteps(none.runDir, tape.steps.length);
    for (let i = 0; i < tape.steps.length; i++) {
      const dir = path.join(run.runDir, TURNS_DIR, `step-${String(i + 1).padStart(2, '0')}`);
      const env = JSON.parse(fs.readFileSync(path.join(dir, `envelope-step-${String(i + 1).padStart(2, '0')}.json`), 'utf8')) as ReplayEnvelope;
      const after = env.toolCalls.filter((c) => c.phase === 'after-step');
      const reported = [...new Set(after.flatMap((c) => c.violations.map((v) => `${v.rule} ${v.path}`)))].sort();
      const noneStep = noneSteps[i];
      const ev = noneStep?.turns.find((t) => t.kind === 'step')?.snapshot.evaluation;
      const full = [...new Set((ev?.blockingFindings ?? []).map((f) => `${f.ruleId} ${f.filePath}`))].sort();
      rows.push({
        taskId: run.spec.taskId,
        step: i + 1,
        toolReported: reported,
        fullBlocking: full,
        scriptedViolation: tape.steps[i]?.violating !== undefined,
        fixApplied: env.feedback?.fixApplied ?? false,
        unfollowed: env.feedback?.unfollowed ?? false,
        toolErrors: env.toolCalls.filter((c) => !c.ok).map((c) => `${c.tool}: ${c.message ?? ''}`),
      });
    }
  }
  return rows;
}

export interface LabelRow {
  readonly runId: string;
  readonly step: number;
  readonly identity: string;
  readonly verdict: string;
  readonly reason: string;
}

/** Labels every new blocking finding (memo §3) with the deterministic correctness checker. */
export async function labelNewBlocking(result: ReplayResult, repoRoot: string, scratch: string, steps: number): Promise<LabelRow[]> {
  const rows: LabelRow[] = [];
  const sources = new SourceFactsCache();
  let n = 0;
  for (const run of result.runs) {
    const records = readRunSteps(run.runDir, steps);
    const outcomes = runOutcomes(records);
    for (const ns of outcomes.newBlocking) {
      if (ns.count === null || ns.count === 0) continue;
      const rec = records[ns.step - 1];
      const last = rec?.turns[rec.turns.length - 1];
      if (rec === undefined || last === undefined) continue;
      const report = JSON.parse(fs.readFileSync(path.join(run.runDir, TURNS_DIR, `step-${String(ns.step).padStart(2, '0')}`, `report-${last.turnId}.json`), 'utf8')) as unknown;
      const specFile = specFileOf(repoRoot, run.runDir, rec);
      const spec = await loadSpecView(specFile);
      const style = spec.style;
      const findings = findingsOfReport(report, { projectId: run.runId }, style);
      const root = path.join(scratch, `label-${String(n++)}`);
      checkoutCommit(path.join(run.runDir, SNAPSHOT_GIT_DIR), last.snapshot.commit, root);
      const facts = sources.get(root, 'adr-032');
      for (const f of ns.findings) {
        const match = findings.find((x) => x.violationId === f.violationId);
        if (match === undefined) {
          rows.push({ runId: run.runId, step: ns.step, identity: findingIdentity(f), verdict: 'missing-in-report', reason: 'no report violation with this id' });
          continue;
        }
        const r = checkFinding(match, spec, facts);
        rows.push({ runId: run.runId, step: ns.step, identity: findingIdentity(f), verdict: r.verdict, reason: r.reason });
      }
    }
  }
  return rows;
}

function zeroTiming(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(zeroTiming);
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = TIMING_KEYS.includes(k) && typeof x === 'number' ? 0 : zeroTiming(x);
    return out;
  }
  return v;
}

function walk(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isSymbolicLink()) out.push(`${r} -> (symlink)`);
    else if (e.isDirectory()) out.push(...walk(root, r));
    else out.push(r);
  }
  return out;
}

export interface CanonicalTree {
  /** POSIX path -> sha256 of the canonical bytes. */
  readonly files: ReadonlyMap<string, string>;
  /** Run directory -> `git log` of its snapshot store (`<commit> <tree> <subject>`). */
  readonly commits: ReadonlyMap<string, string>;
  /** Files whose bytes needed timing fields set to 0. */
  readonly normalised: readonly string[];
  readonly excluded: readonly string[];
}

/**
 * The replay output as compared across two replays: every file except the `timing-*.json` files and the snapshot
 * stores' internals (their index holds stat data), JSON with only `TIMING_KEYS` zeroed; plus each store's commit log.
 */
export function canonicalTree(outRoot: string): CanonicalTree {
  const files = new Map<string, string>();
  const commits = new Map<string, string>();
  const normalised: string[] = [];
  const excluded: string[] = [];
  for (const rel of walk(outRoot)) {
    if (rel.includes(`/${SNAPSHOT_GIT_DIR}/`)) {
      const store = rel.slice(0, rel.indexOf(`/${SNAPSHOT_GIT_DIR}/`));
      if (!commits.has(store)) {
        const log = spawnSync('git', [`--git-dir=${path.join(outRoot, store, SNAPSHOT_GIT_DIR)}`, 'log', '--reverse', '--format=%H %T %s'], { encoding: 'utf8' });
        commits.set(store, log.stdout);
      }
      continue;
    }
    if (TIMING_FILE.test(rel)) {
      excluded.push(rel);
      continue;
    }
    if (rel.endsWith(' -> (symlink)')) {
      files.set(rel, 'symlink');
      continue;
    }
    let bytes = fs.readFileSync(path.join(outRoot, rel));
    if (rel.endsWith('.json')) {
      // A file that is not JSON (a truncated record a resume set aside, loop fault drill D7) is compared raw.
      let parsed: unknown;
      let isJson = true;
      try {
        parsed = JSON.parse(bytes.toString('utf8'));
      } catch {
        isJson = false;
      }
      if (isJson) {
        const canon = `${JSON.stringify(zeroTiming(parsed), null, 2)}\n`;
        if (canon !== `${JSON.stringify(parsed, null, 2)}\n`) normalised.push(rel);
        bytes = Buffer.from(canon);
      }
    }
    files.set(rel, crypto.createHash('sha256').update(bytes).digest('hex'));
  }
  return { files, commits, normalised, excluded };
}

export interface ReproCheck {
  readonly identical: boolean;
  readonly files: number;
  readonly differing: readonly string[];
  readonly normalised: number;
  readonly excludedTimingFiles: number;
  readonly digest: string;
}

export function compareReplays(a: string, b: string): ReproCheck {
  const ca = canonicalTree(a);
  const cb = canonicalTree(b);
  const differing: string[] = [];
  for (const k of new Set([...ca.files.keys(), ...cb.files.keys()])) if (ca.files.get(k) !== cb.files.get(k)) differing.push(k);
  for (const k of new Set([...ca.commits.keys(), ...cb.commits.keys()])) if (ca.commits.get(k) !== cb.commits.get(k)) differing.push(`${k} (commits)`);
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify([[...ca.files.entries()], [...ca.commits.entries()]]))
    .digest('hex');
  return { identical: differing.length === 0, files: ca.files.size, differing: differing.sort(), normalised: ca.normalised.length, excludedTimingFiles: ca.excluded.length, digest };
}

export interface LatencyRow {
  readonly taskId: string;
  readonly arm: string;
  readonly step: number;
  /** The step turn: the scripted edits plus, in `daedalus-mcp`, every tool call. */
  readonly stepTurnMs: number;
  readonly toolCalls: number;
  readonly toolMs: number;
  readonly typecheckMs: readonly number[];
  /** `evaluate_project` (Neo4j) per snapshot of the step, as recorded (`evaluation.durationMs`, the pipeline's figure). */
  readonly evaluateMs: readonly number[];
  /** The same calls' wall time as the loop waited for them (connection, extraction, ingestion included). */
  readonly evaluateWallMs: readonly number[];
  readonly repairTurnMs: number | null;
}

export function latency(result: ReplayResult, steps: number): LatencyRow[] {
  const rows: LatencyRow[] = [];
  for (const run of result.runs) {
    const tc = [...(result.typecheckMs.get(run.runId) ?? [])];
    const ew = [...(result.evaluateWallMs.get(run.runId) ?? [])];
    for (const s of readRunSteps(run.runDir, steps)) {
      const dir = path.join(run.runDir, TURNS_DIR, `step-${String(s.stepIndex + 1).padStart(2, '0')}`);
      const timing = JSON.parse(fs.readFileSync(path.join(dir, `timing-${s.turns[0]?.turnId ?? ''}.json`), 'utf8')) as ReplayTiming;
      const repair = s.turns.find((t) => t.kind === 'repair');
      rows.push({
        taskId: run.spec.taskId,
        arm: run.spec.arm,
        step: s.stepIndex + 1,
        stepTurnMs: s.turns[0]?.result.wallMs ?? 0,
        toolCalls: timing.toolCalls.length,
        toolMs: Math.round(timing.toolCalls.reduce((a, c) => a + c.ms, 0) * 1000) / 1000,
        typecheckMs: tc.splice(0, s.turns.length).map((v) => Math.round(v)),
        evaluateMs: s.turns.map((t) => t.snapshot.evaluation?.durationMs ?? -1),
        evaluateWallMs: ew.splice(0, s.turns.length).map((v) => Math.round(v)),
        repairTurnMs: repair?.result.wallMs ?? null,
      });
    }
  }
  return rows;
}

export interface ReplayVerification {
  readonly outcomes: readonly RunOutcomes[];
  readonly unmatched: readonly { readonly runId: string; readonly step: number; readonly share: number | null }[];
  readonly gate: readonly GateCheck[];
  readonly consistency: readonly ConsistencyRow[];
  readonly mcp: readonly McpFeedbackRow[];
  readonly labels: readonly LabelRow[];
  readonly latency: readonly LatencyRow[];
}

/** Every check of one replay except reproducibility (which needs two). */
export async function verifyReplay(result: ReplayResult, tapes: readonly ReplayTape[], repoRoot: string, scratch: string): Promise<ReplayVerification> {
  const steps = tapes[0]?.steps.length ?? 0;
  const outcomes = result.runs.map((r) => runOutcomes(readRunSteps(r.runDir, steps)));
  const unmatched: ReplayVerification['unmatched'][number][] = [];
  for (const run of result.runs) {
    for (const s of readRunSteps(run.runDir, steps)) {
      const last = s.turns[s.turns.length - 1];
      unmatched.push({ runId: run.runId, step: s.stepIndex + 1, share: await unmatchedShare(specFileOf(repoRoot, run.runDir, s), last?.snapshot.sourceFiles ?? []) });
    }
  }
  return {
    outcomes,
    unmatched,
    gate: gateExactness(result, tapes),
    consistency: await consistency(result, repoRoot, scratch, steps),
    mcp: mcpFeedback(result, tapes),
    labels: await labelNewBlocking(result, repoRoot, scratch, steps),
    latency: latency(result, steps),
  };
}

/** The step-record files of a run (for tests that read them directly). */
export function stepFiles(runDir: string): string[] {
  return fs.readdirSync(path.join(runDir, STEPS_DIR)).sort();
}
