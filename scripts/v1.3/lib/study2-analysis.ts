/**
 * Study 2 analysis, from raw loop telemetry to every planned table. NOT A PRE-REGISTRATION: the outline's candidate
 * analysis 1 (`Docs/v1.3/study2-outline.md` §5) with the pilot memo's switch rule (`Docs/v1.3/pilot-outcome-memo.md`
 * §3, §5). Every choice the outline leaves open is a named `AnalysisOptions` field or a constant below, and is listed
 * in `Docs/v1.3/study2-analysis-rehearsal.md` §5; nothing here is locked. Pure; no I/O (the CLI is
 * `scripts/v1.3/study2-analyse.ts`).
 *
 * Input: the step records (`loop-step/v1`) and run records (`loop-run/v1`) the harness writes. The step outcome is the
 * LAST turn's snapshot (post-repair in `gate`), as the harness defines it. A step whose evaluation failed has no
 * outcome; the slope is fitted on the steps that have one (at least `minStepsForSlope`).
 *
 * Primary analysis (candidate 1): one OLS slope per run on the step index 1..k; per block (adapter × model × task ×
 * run index, every arm present) the difference arm − `none`; the mean difference; a two-sided sign-flip test (exact up
 * to 14 blocks, else Monte Carlo); Holm over the confirmatory contrasts (`gate` − `none`, `daedalus-mcp` − `none`);
 * a two-stage cluster bootstrap (tasks, then blocks within tasks) for the mean difference and the relative reduction
 * (1 − mean slope of the arm / mean slope of `none`, paired blocks); d_z = mean / SD of the block differences.
 * `gate` − `daedalus-mcp` is secondary (unadjusted). Task-level effects (forest plot) and the task-level sign-flip
 * p-value (smallest attainable 2 / 2^tasks) are reported beside the pooled estimate.
 */
import { createRng, quantileSorted, wilson } from '../../lib/stats.js';
import type { SeededRng } from '../../lib/stats.js';
import type { LoopArm, RunRecord, StepRecord, TurnRecord } from '../../lib/loop/types.js';
import { signFlipP } from './study2-power.js';

export const CV05_RULE = 'FF-CV05';
export const CONFIRMATORY: readonly (readonly [LoopArm, LoopArm])[] = [['gate', 'none'], ['daedalus-mcp', 'none']];
export const SECONDARY_CONTRASTS: readonly (readonly [LoopArm, LoopArm])[] = [['gate', 'daedalus-mcp']];

export interface LoadedRun {
  readonly run: RunRecord;
  readonly steps: readonly StepRecord[];
}

export type PrimaryOutcome = 'blocking' | 'advisory-per-kloc';

export interface AnalysisOptions {
  readonly seed: number;
  readonly resamples: number;
  readonly flips: number;
  readonly alpha: number;
  /** Fewest steps with an outcome for a run's slope to be defined. */
  readonly minStepsForSlope: number;
  /** Only the confirmatory table (the calibration loop uses this). */
  readonly primaryOnly?: boolean;
}

export const DEFAULT_OPTIONS: AnalysisOptions = { seed: 20261016, resamples: 4999, flips: 9999, alpha: 0.05, minStepsForSlope: 3 };

// ── Per-step and per-run rows ─────────────────────────────────────────────────

export interface StepRow {
  readonly step: number;
  readonly blocking: number | null;
  readonly kloc: number;
  /** Advisory findings without FF-CV05: null unless the evaluation carries `advisoryByRule` (written since PR #142). */
  readonly advisoryExclCv05: number | null;
  readonly advisoryTotal: number | null;
  readonly ahs: number | null;
  readonly blockingAhs: number | null;
  readonly typecheckErrors: number | null;
  readonly files: number;
  readonly loc: number;
  readonly skeletonIntact: boolean;
  readonly evaluationError: boolean;
  readonly nonCompletedTurns: number;
}

export interface RunRow {
  readonly runId: string;
  readonly model: string;
  readonly taskId: string;
  readonly arm: LoopArm;
  readonly runIndex: number;
  readonly blockKey: string;
  readonly k: number;
  readonly stepsRecorded: number;
  readonly stepsWithOutcome: number;
  readonly complete: boolean;
  readonly dryRun: boolean;
  readonly steps: readonly StepRow[];
  readonly metrics: Readonly<Record<MetricId, number | null>>;
}

export type MetricId =
  | 'blockingSlope'
  | 'blockingPerKlocSlope'
  | 'advisoryExclCv05PerKlocSlope'
  | 'advisoryTotalPerKlocSlope'
  | 'ahsAtK'
  | 'ahsSlope'
  | 'ahsAuc'
  | 'blockingAhsAtK'
  | 'blockingAhsSlope'
  | 'blockingAhsAuc'
  | 'locAtK'
  | 'filesAtK'
  | 'typecheckErrorsPerStep';

export const METRIC_LABEL: Readonly<Record<MetricId, string>> = {
  blockingSlope: 'Erosion slope: blocking violations per step',
  blockingPerKlocSlope: 'Erosion slope: blocking violations per KLOC, per step',
  advisoryExclCv05PerKlocSlope: 'Advisory violations per KLOC (FF-CV05 excluded), slope per step',
  advisoryTotalPerKlocSlope: 'Advisory violations per KLOC (all advisory rules, FF-CV05 INCLUDED), slope per step',
  ahsAtK: 'AHS (v1.2E symbolic) at step k',
  ahsSlope: 'AHS slope per step',
  ahsAuc: 'AHS area under the curve (trapezoid, per step)',
  blockingAhsAtK: 'Blocking-only AHS at step k',
  blockingAhsSlope: 'Blocking-only AHS slope per step',
  blockingAhsAuc: 'Blocking-only AHS area under the curve (trapezoid, per step)',
  locAtK: 'LOC at step k (guard: feature dropping)',
  filesAtK: 'Source files at step k (guard: feature dropping)',
  typecheckErrorsPerStep: 'Type-check errors per step (guard)',
};

export function ols(points: readonly (readonly [number, number])[]): number | null {
  if (points.length < 2) return null;
  const xm = points.reduce((a, p) => a + p[0], 0) / points.length;
  const ym = points.reduce((a, p) => a + p[1], 0) / points.length;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - xm) * (y - ym);
    den += (x - xm) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** Trapezoid area over the observed steps, divided by the span (a mean level); null under two points. */
export function auc(points: readonly (readonly [number, number])[]): number | null {
  if (points.length < 2) return null;
  let a = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (p === undefined || q === undefined) continue;
    a += ((q[0] - p[0]) * (p[1] + q[1])) / 2;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return first === undefined || last === undefined || last[0] === first[0] ? null : a / (last[0] - first[0]);
}

function lastTurn(r: StepRecord): TurnRecord | undefined {
  return r.turns[r.turns.length - 1];
}

function stepRow(r: StepRecord): StepRow {
  const t = lastTurn(r);
  const snap = t?.snapshot;
  const ev = snap?.evaluation ?? null;
  const byRule = (ev as { advisoryByRule?: Readonly<Record<string, number>> } | null)?.advisoryByRule;
  const loc = snap?.loc ?? 0;
  return {
    step: r.stepIndex + 1,
    blocking: ev?.blockingViolationCount ?? null,
    kloc: loc / 1000,
    advisoryExclCv05: ev !== null && byRule !== undefined ? Object.entries(byRule).filter(([k]) => k !== CV05_RULE).reduce((a, [, v]) => a + v, 0) : null,
    advisoryTotal: ev?.advisoryViolationCount ?? null,
    ahs: ev?.ahs ?? null,
    blockingAhs: ev?.blockingAhs ?? null,
    typecheckErrors: snap?.typecheck?.errors ?? null,
    files: snap?.sourceFiles.length ?? 0,
    loc,
    skeletonIntact: r.turns.every((x) => x.snapshot.skeletonIntact),
    evaluationError: ev === null,
    nonCompletedTurns: r.turns.filter((x) => x.result.status !== 'completed').length,
  };
}

export function blockKey(run: RunRecord): string {
  const s = run.spec;
  return `${s.adapterId}/${s.modelId}/${s.taskId}/run-${String(s.runIndex)}`;
}

export function runRows(runs: readonly LoadedRun[], o: Pick<AnalysisOptions, 'minStepsForSlope'>): RunRow[] {
  return runs.map(({ run, steps }) => {
    const rows = steps.map(stepRow);
    const pts = (f: (s: StepRow) => number | null): [number, number][] =>
      rows.flatMap((s) => {
        const v = f(s);
        return v === null || !Number.isFinite(v) ? [] : [[s.step, v] as [number, number]];
      });
    const slope = (f: (s: StepRow) => number | null): number | null => {
      const p = pts(f);
      return p.length >= o.minStepsForSlope ? ols(p) : null;
    };
    const atK = (f: (s: StepRow) => number | null): number | null => {
      const last = rows[rows.length - 1];
      return last !== undefined && last.step === run.steps ? f(last) : null;
    };
    const perKloc = (f: (s: StepRow) => number | null) => (s: StepRow): number | null => {
      const v = f(s);
      return v === null || s.kloc <= 0 ? null : v / s.kloc;
    };
    const ahsAuc = (f: (s: StepRow) => number | null): number | null => (pts(f).length >= o.minStepsForSlope ? auc(pts(f)) : null);
    const tc = rows.map((s) => s.typecheckErrors).filter((x): x is number => x !== null);
    const metrics: Record<MetricId, number | null> = {
      blockingSlope: slope((s) => s.blocking),
      blockingPerKlocSlope: slope(perKloc((s) => s.blocking)),
      advisoryExclCv05PerKlocSlope: slope(perKloc((s) => s.advisoryExclCv05)),
      advisoryTotalPerKlocSlope: slope(perKloc((s) => s.advisoryTotal)),
      ahsAtK: atK((s) => s.ahs),
      ahsSlope: slope((s) => s.ahs),
      ahsAuc: ahsAuc((s) => s.ahs),
      blockingAhsAtK: atK((s) => s.blockingAhs),
      blockingAhsSlope: slope((s) => s.blockingAhs),
      blockingAhsAuc: ahsAuc((s) => s.blockingAhs),
      locAtK: atK((s) => s.loc),
      filesAtK: atK((s) => s.files),
      typecheckErrorsPerStep: tc.length === 0 ? null : tc.reduce((a, b) => a + b, 0) / tc.length,
    };
    return {
      runId: run.runId,
      model: `${run.spec.adapterId}/${run.spec.modelId}`,
      taskId: run.spec.taskId,
      arm: run.spec.arm,
      runIndex: run.spec.runIndex,
      blockKey: blockKey(run),
      k: run.steps,
      stepsRecorded: rows.length,
      stepsWithOutcome: rows.filter((s) => s.blocking !== null).length,
      complete: rows.length === run.steps && run.completedAt !== undefined,
      dryRun: run.dryRun,
      steps: rows,
      metrics,
    };
  });
}

// ── Inference ─────────────────────────────────────────────────────────────────

export interface Interval {
  readonly low: number | null;
  readonly high: number | null;
}

export interface PairedBlock {
  readonly task: string;
  readonly model: string;
  readonly a: number;
  readonly b: number;
}

export interface TaskEffect {
  readonly taskId: string;
  readonly blocks: number;
  readonly meanDiff: number;
  readonly ci: Interval;
}

export interface ContrastResult {
  readonly metric: MetricId;
  readonly arm: LoopArm;
  readonly reference: LoopArm;
  readonly blocks: number;
  readonly tasks: number;
  readonly meanArm: number | null;
  readonly meanReference: number | null;
  readonly meanDiff: number | null;
  readonly ci: Interval;
  readonly sdDiff: number | null;
  readonly dz: number | null;
  /** 1 − mean(arm) / mean(reference) over the paired blocks; null when the reference mean is not positive. */
  readonly relativeReduction: number | null;
  readonly relativeReductionCi: Interval;
  readonly p: number | null;
  readonly taskEffects: readonly TaskEffect[];
  readonly taskLevelP: number | null;
  readonly taskLevelMinP: number | null;
  /** Holm-adjusted p and rejection, confirmatory contrasts only. */
  readonly holmP?: number | null;
  readonly holmReject?: boolean;
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: readonly number[]): number => {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/** Two-stage cluster bootstrap: tasks with replacement, then blocks with replacement within each drawn task. */
export function twoStageBootstrap(
  blocks: readonly PairedBlock[], stat: (s: readonly PairedBlock[]) => number, resamples: number, alpha: number, rng: SeededRng,
): Interval {
  const byTask = new Map<string, PairedBlock[]>();
  for (const b of blocks) byTask.set(b.task, [...(byTask.get(b.task) ?? []), b]);
  const tasks = [...byTask.values()];
  if (tasks.length === 0) return { low: null, high: null };
  const vals: number[] = [];
  for (let r = 0; r < resamples; r++) {
    const sample: PairedBlock[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[rng.int(tasks.length)] ?? [];
      for (let j = 0; j < t.length; j++) {
        const b = t[rng.int(t.length)];
        if (b !== undefined) sample.push(b);
      }
    }
    const v = stat(sample);
    if (Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return { low: null, high: null };
  vals.sort((x, y) => x - y);
  return { low: quantileSorted(vals, alpha / 2), high: quantileSorted(vals, 1 - alpha / 2) };
}

function bootstrapWithin(blocks: readonly PairedBlock[], resamples: number, alpha: number, rng: SeededRng): Interval {
  if (blocks.length < 2) return { low: null, high: null };
  const vals: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let j = 0; j < blocks.length; j++) {
      const b = blocks[rng.int(blocks.length)];
      if (b !== undefined) s += b.a - b.b;
    }
    vals.push(s / blocks.length);
  }
  vals.sort((x, y) => x - y);
  return { low: quantileSorted(vals, alpha / 2), high: quantileSorted(vals, 1 - alpha / 2) };
}

const meanDiffStat = (s: readonly PairedBlock[]): number => (s.length === 0 ? Number.NaN : mean(s.map((b) => b.a - b.b)));
const relRedStat = (s: readonly PairedBlock[]): number => {
  if (s.length === 0) return Number.NaN;
  const ref = mean(s.map((b) => b.b));
  return ref > 0 ? 1 - mean(s.map((b) => b.a)) / ref : Number.NaN;
};

export function pairBlocks(rows: readonly RunRow[], metric: MetricId, arm: LoopArm, ref: LoopArm): PairedBlock[] {
  const byKey = new Map<string, Map<LoopArm, RunRow>>();
  for (const r of rows) {
    const m = byKey.get(r.blockKey) ?? new Map<LoopArm, RunRow>();
    m.set(r.arm, r);
    byKey.set(r.blockKey, m);
  }
  const out: PairedBlock[] = [];
  for (const m of [...byKey.keys()].sort().map((k) => byKey.get(k))) {
    const x = m?.get(arm);
    const y = m?.get(ref);
    const a = x?.metrics[metric];
    const b = y?.metrics[metric];
    if (x === undefined || a === null || a === undefined || b === null || b === undefined) continue;
    out.push({ task: x.taskId, model: x.model, a, b });
  }
  return out;
}

export function contrast(rows: readonly RunRow[], metric: MetricId, arm: LoopArm, ref: LoopArm, o: AnalysisOptions, seedOffset: number): ContrastResult {
  const blocks = pairBlocks(rows, metric, arm, ref);
  const rng = createRng(o.seed + seedOffset);
  const diffs = blocks.map((b) => b.a - b.b);
  const tasks = [...new Set(blocks.map((b) => b.task))].sort();
  const taskEffects: TaskEffect[] = tasks.map((t) => {
    const tb = blocks.filter((b) => b.task === t);
    return { taskId: t, blocks: tb.length, meanDiff: meanDiffStat(tb), ci: bootstrapWithin(tb, Math.min(o.resamples, 1999), o.alpha, rng) };
  });
  const n = blocks.length;
  const md = n === 0 ? null : mean(diffs);
  const s = n < 2 ? null : sd(diffs);
  const rr = n === 0 ? null : relRedStat(blocks);
  return {
    metric, arm, reference: ref, blocks: n, tasks: tasks.length,
    meanArm: n === 0 ? null : mean(blocks.map((b) => b.a)),
    meanReference: n === 0 ? null : mean(blocks.map((b) => b.b)),
    meanDiff: md,
    ci: n === 0 ? { low: null, high: null } : twoStageBootstrap(blocks, meanDiffStat, o.resamples, o.alpha, rng),
    sdDiff: s,
    dz: md === null || s === null || !(s > 0) ? null : md / s,
    relativeReduction: rr === null || !Number.isFinite(rr) ? null : rr,
    relativeReductionCi: n === 0 ? { low: null, high: null } : twoStageBootstrap(blocks, relRedStat, o.resamples, o.alpha, rng),
    p: n === 0 ? null : signFlipP(diffs, o.flips, rng),
    taskEffects,
    taskLevelP: tasks.length === 0 ? null : signFlipP(taskEffects.map((t) => t.meanDiff), o.flips, rng),
    taskLevelMinP: tasks.length === 0 ? null : Math.max(2 / 2 ** tasks.length, 0),
  };
}

/** Holm step-down adjusted p-values (null p stays null and is not counted). */
export function holmAdjust(ps: readonly (number | null)[]): (number | null)[] {
  const idx = ps.map((p, i) => [p, i] as const).filter((x): x is readonly [number, number] => x[0] !== null).sort((a, b) => a[0] - b[0]);
  const m = idx.length;
  const out: (number | null)[] = ps.map(() => null);
  let run = 0;
  idx.forEach(([p, i], j) => {
    run = Math.max(run, Math.min(1, (m - j) * p));
    out[i] = run;
  });
  return out;
}

// ── Pilot switch rule (memo §3, §5) ───────────────────────────────────────────

/** Labels from `check-correct.ts` per finding identity (`ruleId|filePath|target`). */
export type FindingLabel = 'correct' | 'incorrect' | 'not-checkable-confirmed' | 'not-checkable';

export interface SwitchDecision {
  readonly source: 'pilot' | 'override';
  readonly perTask: readonly { readonly taskId: string; readonly newBlockingAfterStep1: number; readonly unlabelled: number; readonly excludedByLabel: number }[];
  readonly erosion: boolean | null;
  readonly primary: PrimaryOutcome;
  readonly fallbackTriggered: boolean;
  readonly statement: string;
  readonly provisional: boolean;
}

export function findingIdentity(f: { readonly ruleId: string; readonly filePath: string; readonly target?: string }): string {
  return `${f.ruleId}|${f.filePath}|${f.target ?? ''}`;
}

/**
 * The memo's primary outcome on the pilot's `none` arm: per task, the blocking findings first seen at step 2..k by
 * identity (rule, file, target; lines ignored). With labels, only `correct` and `not-checkable-confirmed` count;
 * without labels every new finding counts and the decision is marked provisional.
 */
export function pilotSwitch(pilot: readonly LoadedRun[], labels: ReadonlyMap<string, FindingLabel> | null): SwitchDecision {
  const none = pilot.filter((r) => r.run.spec.arm === 'none');
  const perTask = [...new Set(none.map((r) => r.run.spec.taskId))].sort().map((taskId) => {
    let counted = 0;
    let unlabelled = 0;
    let excluded = 0;
    for (const r of none.filter((x) => x.run.spec.taskId === taskId)) {
      const seen = new Set<string>();
      for (const s of r.steps) {
        const ev = lastTurn(s)?.snapshot.evaluation ?? null;
        const ids = new Set((ev?.blockingFindings ?? []).map(findingIdentity));
        for (const id of ids) {
          if (s.stepIndex > 0 && !seen.has(id)) {
            const l = labels?.get(id);
            if (labels === null || l === undefined) {
              unlabelled += 1;
              counted += 1;
            } else if (l === 'correct' || l === 'not-checkable-confirmed') counted += 1;
            else excluded += 1;
          }
        }
        for (const id of ids) seen.add(id);
      }
    }
    return { taskId, newBlockingAfterStep1: counted, unlabelled, excludedByLabel: excluded };
  });
  const erosion = perTask.length === 0 ? null : perTask.some((t) => t.newBlockingAfterStep1 > 0);
  const provisional = perTask.some((t) => t.unlabelled > 0) || labels === null;
  const primary: PrimaryOutcome = erosion === false ? 'advisory-per-kloc' : 'blocking';
  const statement =
    erosion === null
      ? 'The pilot holds no `none`-arm run: the memo §3 outcome cannot be computed and the switch rule cannot be applied.'
      : erosion
        ? `Pilot memo §3: erosion EXISTS (new blocking findings after step 1 in ${String(perTask.filter((t) => t.newBlockingAfterStep1 > 0).length)} of ${String(perTask.length)} tasks). Per memo §5 the Study 2 primary outcome stays the blocking erosion slope.`
        : `Pilot memo §3: the primary outcome is ZERO (no new blocking finding after step 1 in any of ${String(perTask.length)} tasks). Per memo §5 the PRE-COMMITTED FALLBACK applies: the Study 2 primary outcome moves to the advisory-tier erosion rate (per-run slope of advisory findings per KLOC, FF-CV05 excluded).`;
  return { source: 'pilot', perTask, erosion, primary, fallbackTriggered: erosion === false, statement, provisional };
}

export function overrideSwitch(primary: PrimaryOutcome, reason: string): SwitchDecision {
  return {
    source: 'override', perTask: [], erosion: null, primary, fallbackTriggered: primary === 'advisory-per-kloc', provisional: true,
    statement: `No pilot telemetry given: the primary outcome was set to ${primary} by --primary (${reason}). The memo §5 rule was NOT applied.`,
  };
}

// ── Descriptive tables ────────────────────────────────────────────────────────

export interface Estimate {
  readonly n: number;
  readonly mean: number | null;
  readonly ci: Interval;
}

/** Mean of per-unit values with a task-cluster bootstrap interval. */
function clusterMean(units: readonly { readonly task: string; readonly v: number }[], o: AnalysisOptions, rng: SeededRng): Estimate {
  if (units.length === 0) return { n: 0, mean: null, ci: { low: null, high: null } };
  const pb = units.map((u) => ({ task: u.task, model: '', a: u.v, b: 0 }));
  return { n: units.length, mean: mean(units.map((u) => u.v)), ci: twoStageBootstrap(pb, meanDiffStat, Math.min(o.resamples, 1999), o.alpha, rng) };
}

export interface RepairTable {
  readonly gateSteps: number;
  readonly failingSteps: number;
  readonly repairsWithOutcome: number;
  readonly cleared: number;
  readonly clearedShare: number | null;
  readonly clearedWilson: Interval;
  readonly clearedShareClusterCi: Interval;
  readonly meanReduction: Estimate;
  readonly introducedFindings: number;
  readonly repairEvaluationFailed: number;
}

export function repairTable(runs: readonly LoadedRun[], o: AnalysisOptions): RepairTable {
  const rng = createRng(o.seed + 900);
  const gate = runs.filter((r) => r.run.spec.arm === 'gate');
  const steps = gate.flatMap((r) => r.steps.map((s) => ({ task: r.run.spec.taskId, s })));
  const failing = steps.filter((x) => x.s.repair?.attempted === true);
  const withOutcome = failing.filter((x) => x.s.repair?.cleared !== null && x.s.repair?.cleared !== undefined);
  const cleared = withOutcome.filter((x) => x.s.repair?.cleared === true).length;
  const w = withOutcome.length === 0 ? null : wilson(cleared, withOutcome.length);
  const share = clusterMean(withOutcome.map((x) => ({ task: x.task, v: x.s.repair?.cleared === true ? 1 : 0 })), o, rng);
  const red = withOutcome.map((x) => ({ task: x.task, v: (x.s.repair?.blockingBefore ?? 0) - (x.s.repair?.blockingAfter ?? 0) }));
  return {
    gateSteps: steps.length,
    failingSteps: failing.length,
    repairsWithOutcome: withOutcome.length,
    cleared,
    clearedShare: withOutcome.length === 0 ? null : cleared / withOutcome.length,
    clearedWilson: w === null ? { low: null, high: null } : { low: w.low, high: w.high },
    clearedShareClusterCi: share.ci,
    meanReduction: clusterMean(red, o, rng),
    introducedFindings: failing.reduce((a, x) => a + (x.s.repairOutcome?.introduced ?? 0), 0),
    repairEvaluationFailed: failing.length - withOutcome.length,
  };
}

export interface CostRow {
  readonly arm: LoopArm;
  readonly steps: number;
  readonly stepsWithCost: number;
  readonly costPerStepUsd: Estimate;
  readonly costPerRunUsd: Estimate;
  readonly inputTokensPerStep: Estimate;
  readonly outputTokensPerStep: Estimate;
  readonly wallMinutesPerStep: Estimate;
  readonly agentTurnsPerStep: Estimate;
  readonly repairTurns: number;
  readonly repairCostUsd: number;
  readonly usageLimitInterruptions: number;
}

export function costTable(runs: readonly LoadedRun[], arms: readonly LoopArm[], o: AnalysisOptions): CostRow[] {
  const rng = createRng(o.seed + 700);
  return arms.map((arm) => {
    const rs = runs.filter((r) => r.run.spec.arm === arm);
    const steps = rs.flatMap((r) => r.steps.map((s) => ({ task: r.run.spec.taskId, s })));
    const num = (f: (s: StepRecord) => number | null) =>
      steps.flatMap((x) => {
        const v = f(x.s);
        return v === null ? [] : [{ task: x.task, v }];
      });
    const perRun = rs.flatMap((r) => {
      const c = r.steps.map((s) => s.cost.costUsd);
      return c.length === 0 || c.some((x) => x === null) ? [] : [{ task: r.run.spec.taskId, v: c.reduce<number>((a, b) => a + (b ?? 0), 0) }];
    });
    const repairTurns = steps.flatMap((x) => x.s.turns.filter((t) => t.kind === 'repair'));
    return {
      arm,
      steps: steps.length,
      stepsWithCost: num((s) => s.cost.costUsd).length,
      costPerStepUsd: clusterMean(num((s) => s.cost.costUsd), o, rng),
      costPerRunUsd: clusterMean(perRun, o, rng),
      inputTokensPerStep: clusterMean(num((s) => s.cost.inputTokens), o, rng),
      outputTokensPerStep: clusterMean(num((s) => s.cost.outputTokens), o, rng),
      wallMinutesPerStep: clusterMean(num((s) => s.cost.wallMs / 60000), o, rng),
      agentTurnsPerStep: clusterMean(num((s) => {
        const t = s.turns.map((x) => x.result.usage.numTurns);
        return t.some((x) => x === null) ? null : t.reduce<number>((a, b) => a + (b ?? 0), 0);
      }), o, rng),
      repairTurns: repairTurns.length,
      repairCostUsd: repairTurns.reduce((a, t) => a + (t.result.usage.costUsd ?? 0), 0),
      usageLimitInterruptions: steps.reduce((a, x) => a + x.s.turns.reduce((b, t) => b + t.result.interruptions.length, 0), 0),
    };
  });
}

export interface GuardRow {
  readonly arm: LoopArm;
  readonly steps: number;
  readonly evaluationErrors: number;
  readonly stepsWithTypecheckErrors: number;
  readonly meanTypecheckErrors: number | null;
  readonly skeletonBroken: number;
  readonly nonCompletedTurns: number;
  readonly meanLocStep1: number | null;
  readonly meanLocStepK: number | null;
  readonly meanFilesStepK: number | null;
  readonly runsWithLocDrop: number;
}

export function guardTable(rows: readonly RunRow[], arms: readonly LoopArm[]): GuardRow[] {
  return arms.map((arm) => {
    const rs = rows.filter((r) => r.arm === arm);
    const steps = rs.flatMap((r) => r.steps);
    const tc = steps.map((s) => s.typecheckErrors).filter((x): x is number => x !== null);
    const at = (f: (s: StepRow) => boolean) => steps.filter(f);
    const m = (xs: readonly number[]): number | null => (xs.length === 0 ? null : mean(xs));
    return {
      arm,
      steps: steps.length,
      evaluationErrors: at((s) => s.evaluationError).length,
      stepsWithTypecheckErrors: at((s) => (s.typecheckErrors ?? 0) > 0).length,
      meanTypecheckErrors: m(tc),
      skeletonBroken: at((s) => !s.skeletonIntact).length,
      nonCompletedTurns: steps.reduce((a, s) => a + s.nonCompletedTurns, 0),
      meanLocStep1: m(at((s) => s.step === 1).map((s) => s.loc)),
      meanLocStepK: m(rs.flatMap((r) => r.steps.filter((s) => s.step === r.k).map((s) => s.loc))),
      meanFilesStepK: m(rs.flatMap((r) => r.steps.filter((s) => s.step === r.k).map((s) => s.files))),
      runsWithLocDrop: rs.filter((r) => r.steps.some((s, i) => i > 0 && s.loc < (r.steps[i - 1]?.loc ?? 0))).length,
    };
  });
}

export interface MissingRow {
  readonly model: string;
  readonly arm: LoopArm;
  readonly runsScheduled: number;
  readonly runsFound: number;
  readonly runsComplete: number;
  readonly stepsExpected: number;
  readonly stepsRecorded: number;
  readonly stepsWithoutOutcome: number;
  readonly runsWithoutSlope: number;
}

export function missingTable(rows: readonly RunRow[], scheduled: readonly string[], arms: readonly LoopArm[]): MissingRow[] {
  const models = [...new Set([...rows.map((r) => r.model), ...scheduled.map((id) => id.split('/').slice(0, 2).join('/'))])].sort();
  const out: MissingRow[] = [];
  for (const model of models) {
    for (const arm of arms) {
      const rs = rows.filter((r) => r.model === model && r.arm === arm);
      out.push({
        model, arm,
        runsScheduled: scheduled.filter((id) => id.startsWith(`${model}/`) && id.split('/')[3] === arm).length,
        runsFound: rs.length,
        runsComplete: rs.filter((r) => r.complete).length,
        stepsExpected: rs.reduce((a, r) => a + r.k, 0),
        stepsRecorded: rs.reduce((a, r) => a + r.stepsRecorded, 0),
        stepsWithoutOutcome: rs.reduce((a, r) => a + (r.stepsRecorded - r.stepsWithOutcome), 0),
        runsWithoutSlope: rs.filter((r) => r.metrics.blockingSlope === null).length,
      });
    }
  }
  return out;
}

export interface TrajectoryPoint {
  readonly arm: LoopArm;
  readonly step: number;
  readonly n: number;
  readonly mean: number | null;
  readonly low: number | null;
  readonly high: number | null;
}

export function trajectory(rows: readonly RunRow[], arms: readonly LoopArm[], value: (s: StepRow) => number | null): TrajectoryPoint[] {
  const k = Math.max(0, ...rows.map((r) => r.k));
  const out: TrajectoryPoint[] = [];
  for (const arm of arms) {
    for (let step = 1; step <= k; step++) {
      const v = rows.filter((r) => r.arm === arm).flatMap((r) => r.steps.filter((s) => s.step === step).map(value)).filter((x): x is number => x !== null && Number.isFinite(x));
      const m = v.length === 0 ? null : mean(v);
      const se = v.length < 2 ? null : sd(v) / Math.sqrt(v.length);
      out.push({ arm, step, n: v.length, mean: m, low: m === null || se === null ? null : m - 1.96 * se, high: m === null || se === null ? null : m + 1.96 * se });
    }
  }
  return out;
}

// ── The report ────────────────────────────────────────────────────────────────

export interface AnalysisReport {
  readonly schema: 'study2-analysis/v0-rehearsal';
  readonly synthetic: boolean;
  readonly options: AnalysisOptions;
  readonly arms: readonly LoopArm[];
  readonly design: { readonly runs: number; readonly blocks: number; readonly tasks: number; readonly models: readonly string[]; readonly k: readonly number[] };
  readonly switch: SwitchDecision;
  /** The metric the primary outcome resolves to on these data, and whether it is the memo's definition. */
  readonly primaryMetric: MetricId;
  readonly primaryDefinitionMet: boolean;
  readonly primaryNotes: readonly string[];
  readonly confirmatory: readonly ContrastResult[];
  readonly secondaryContrasts: readonly ContrastResult[];
  readonly secondaryOutcomes: readonly ContrastResult[];
  readonly perModel: readonly { readonly model: string; readonly contrasts: readonly ContrastResult[] }[];
  readonly floorCheck: { readonly noneSteps: number; readonly noneStepsWithBlocking: number; readonly allStudyBlockingZero: boolean };
  readonly repair: RepairTable | null;
  readonly cost: readonly CostRow[];
  readonly guards: readonly GuardRow[];
  readonly missing: readonly MissingRow[];
  readonly trajectories: { readonly blocking: readonly TrajectoryPoint[]; readonly primary: readonly TrajectoryPoint[]; readonly ahs: readonly TrajectoryPoint[] };
  readonly notComputable: readonly { readonly item: string; readonly reason: string }[];
}

export const NOT_COMPUTABLE: readonly { readonly item: string; readonly reason: string }[] = [
  { item: 'GLMM (outline §5 candidate 2)', reason: 'Not implemented: the outline leaves the choice between candidates 1 and 2 to registration, and a negative-binomial GLMM with crossed random slopes needs an R/Python fit outside this TypeScript toolchain. Listed as an open decision (rehearsal doc §5).' },
  { item: 'Held-out rule violations (Q4)', reason: 'Not in the step record. `holdout-run.ts` (PR #119) scores the hold-out REFERENCE set for the validity gate, not loop snapshots; a held-out-rule score per snapshot needs a re-scoring pass over the kept commits.' },
  { item: 'Dependency-cruiser violations (Q4)', reason: 'Not in the step record; needs the ADR-030 translation run over every snapshot commit.' },
  { item: 'Layer-coverage share, dynamic imports, barrels (gaming guards)', reason: 'Not in the step record (`sourceFiles` lists files but not their layer match); readiness gate D13.' },
  { item: 'MCP tool calls per step, first call before or after the first write (process)', reason: 'The call log is not part of the step record (readiness gate D6).' },
  { item: 'Per-step acceptance checks (feature completeness)', reason: 'Not adopted yet (outline §4); only LOC and file trajectories are reported.' },
  { item: 'Judge dimensions FF-N01, FF-N02', reason: 'Scored offline after the runs (memo §4); not in the step record.' },
];

export function analyse(study: readonly LoadedRun[], scheduled: readonly string[], decision: SwitchDecision, o: AnalysisOptions = DEFAULT_OPTIONS): AnalysisReport {
  const rows = runRows(study, o);
  const arms = (['none', 'daedalus-mcp', 'gate'] as const).filter((a) => rows.some((r) => r.arm === a));
  const notes: string[] = [];
  let primaryMetric: MetricId = 'blockingSlope';
  let primaryDefinitionMet = true;
  if (decision.primary === 'advisory-per-kloc') {
    const allByRule = rows.length > 0 && rows.every((r) => r.steps.every((s) => s.evaluationError || s.advisoryExclCv05 !== null));
    if (allByRule) {
      primaryMetric = 'advisoryExclCv05PerKlocSlope';
    } else {
      primaryMetric = 'advisoryTotalPerKlocSlope';
      primaryDefinitionMet = false;
      notes.push('The memo §5 fallback outcome (advisory per KLOC WITHOUT FF-CV05) is NOT computable from these step records: these records carry only `advisoryViolationCount`, no `advisoryByRule` (records written before PR #142, or by an evaluator that omits it; readiness gate S6). The table below uses ALL advisory rules, FF-CV05 included, as a labelled surrogate; it is not the pre-committed outcome.');
    }
    notes.push('Under the advisory branch the `gate` arm still shows blocking findings only; whether `gate` gets the advisory subset or is dropped is undecided (memo §5, readiness gate D11b). The gate contrast is computed as designed and must be read with that caveat.');
  }
  const confirmatory = CONFIRMATORY.filter(([a, b]) => arms.includes(a) && arms.includes(b)).map(([a, b], i) => contrast(rows, primaryMetric, a, b, o, 10 + i));
  const adj = holmAdjust(confirmatory.map((c) => c.p));
  const conf = confirmatory.map((c, i) => ({ ...c, holmP: adj[i] ?? null, holmReject: (adj[i] ?? 1) <= o.alpha }));
  const noneSteps = rows.filter((r) => r.arm === 'none').flatMap((r) => r.steps);
  const floorCheck = {
    noneSteps: noneSteps.length,
    noneStepsWithBlocking: noneSteps.filter((s) => (s.blocking ?? 0) > 0).length,
    allStudyBlockingZero: rows.every((r) => r.steps.every((s) => (s.blocking ?? 0) === 0)),
  };
  if (decision.primary === 'blocking' && floorCheck.allStudyBlockingZero) {
    notes.push('WARNING: the primary outcome is blocking (pilot showed erosion) but every Study 2 step has zero blocking findings. Memo §5 lets only the pilot change the primary outcome, so it stays blocking and the slope contrasts are degenerate (all differences 0).');
  }
  const tasks = new Set(rows.map((r) => r.taskId));
  const blocks = new Set(rows.map((r) => r.blockKey));
  const base = {
    schema: 'study2-analysis/v0-rehearsal' as const,
    synthetic: rows.some((r) => r.dryRun),
    options: o,
    arms,
    design: { runs: rows.length, blocks: blocks.size, tasks: tasks.size, models: [...new Set(rows.map((r) => r.model))].sort(), k: [...new Set(rows.map((r) => r.k))].sort() },
    switch: decision,
    primaryMetric,
    primaryDefinitionMet,
    primaryNotes: notes,
    confirmatory: conf,
    floorCheck,
  };
  if (o.primaryOnly === true) {
    return { ...base, secondaryContrasts: [], secondaryOutcomes: [], perModel: [], repair: null, cost: [], guards: [], missing: [], trajectories: { blocking: [], primary: [], ahs: [] }, notComputable: NOT_COMPUTABLE };
  }
  const secondaryContrasts = SECONDARY_CONTRASTS.filter(([a, b]) => arms.includes(a) && arms.includes(b)).map(([a, b], i) => contrast(rows, primaryMetric, a, b, o, 20 + i));
  const secondaryMetrics: MetricId[] = (
    [
      'blockingSlope', 'blockingPerKlocSlope', 'advisoryExclCv05PerKlocSlope', 'advisoryTotalPerKlocSlope', 'ahsAtK', 'ahsSlope', 'ahsAuc',
      'blockingAhsAtK', 'blockingAhsSlope', 'blockingAhsAuc', 'locAtK', 'filesAtK', 'typecheckErrorsPerStep',
    ] as const
  ).filter((m) => m !== primaryMetric);
  let off = 100;
  const secondaryOutcomes = secondaryMetrics.flatMap((m) =>
    CONFIRMATORY.filter(([a, b]) => arms.includes(a) && arms.includes(b))
      .map(([a, b]) => contrast(rows, m, a, b, { ...o, resamples: Math.min(o.resamples, 1999) }, (off += 1)))
      .filter((c) => c.blocks > 0),
  );
  const perModel = base.design.models.map((model) => ({
    model,
    contrasts: CONFIRMATORY.filter(([a, b]) => arms.includes(a) && arms.includes(b)).map(([a, b]) => contrast(rows.filter((r) => r.model === model), primaryMetric, a, b, { ...o, resamples: Math.min(o.resamples, 1999) }, (off += 1))),
  }));
  const value = (s: StepRow): number | null => {
    if (primaryMetric === 'blockingSlope') return s.blocking;
    const v = primaryMetric === 'advisoryExclCv05PerKlocSlope' ? s.advisoryExclCv05 : s.advisoryTotal;
    return v === null || s.kloc <= 0 ? null : v / s.kloc;
  };
  return {
    ...base,
    secondaryContrasts,
    secondaryOutcomes,
    perModel,
    repair: arms.includes('gate') ? repairTable(study, o) : null,
    cost: costTable(study, arms, o),
    guards: guardTable(rows, arms),
    missing: missingTable(rows, scheduled, arms),
    trajectories: { blocking: trajectory(rows, arms, (s) => s.blocking), primary: trajectory(rows, arms, value), ahs: trajectory(rows, arms, (s) => s.ahs) },
    notComputable: NOT_COMPUTABLE,
  };
}
