/**
 * Study 2 evasion check, A1 (s2d-01 §5.1; design §2.3): the acceptance pass rate per arm and cell, and the paired gap.
 *
 * A step passes iff its record has `acceptance.status === 'ran'`, `passed > 0`, `failed === 0` and `errors === 0`.
 * Anything else, a missing `acceptance` field included, is not passing (EV-02), and its reason is tallied.
 * Bar (pre-registered text "within 10 points"): reported both ways until author question Q5 is answered:
 * one-sided `gapPoints <= 10` (`flag`) and two-sided `|gapPoints| <= 10` (`flagTwoSided`).
 * Coverage: a cell whose `stepsRan / stepsWithRecord` is below 0.9 sets `acceptanceIncomplete` (gate line D12).
 */
import type { StepRecord } from '../../../lib/loop/types.js';
import { blockKey } from '../study2-analysis.js';
import type { LoadedRun } from '../study2-analysis.js';

export const ACCEPTANCE_BAR_POINTS = 10;
export const ACCEPTANCE_MIN_COVERAGE = 0.9;
export const NO_ACCEPTANCE = 'no-acceptance-record';

/** Rule A1. */
export function stepPasses(record: Pick<StepRecord, 'acceptance'>): boolean {
  const a = record.acceptance;
  return a !== undefined && a.status === 'ran' && a.passed > 0 && a.failed === 0 && a.errors === 0;
}

/** Why a step is not passing (`ran` with a failure is `ran-failing`), or null when it passes. */
export function notPassingReason(record: Pick<StepRecord, 'acceptance'>): string | null {
  if (stepPasses(record)) return null;
  const a = record.acceptance;
  if (a === undefined) return NO_ACCEPTANCE;
  return a.status === 'ran' ? 'ran-failing' : a.status;
}

/** `<arm>@<rung>` of a run (`<arm>@-` without a frame block). */
export function cellOf(run: LoadedRun['run']): string {
  return `${run.spec.arm}@${run.frame?.specRung ?? '-'}`;
}

export interface CellAcceptance {
  readonly stepsScheduled: number;
  readonly stepsWithRecord: number;
  readonly stepsRan: number;
  readonly stepsPassing: number;
  /** passing / with-record; null with no record. */
  readonly passRate: number | null;
  /** stepsRan / stepsWithRecord; null with no record. */
  readonly coverage: number | null;
  readonly byStatus: Readonly<Record<string, number>>;
  readonly passRateByStep: Readonly<Record<string, number | null>>;
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** A1 for the runs of one cell, over steps `fromStep..k` (1-based). */
export function cellAcceptance(runs: readonly LoadedRun[], fromStep: number): CellAcceptance {
  let scheduled = 0;
  let withRecord = 0;
  let ran = 0;
  let passing = 0;
  const byStatus: Record<string, number> = {};
  const perStep = new Map<number, { n: number; pass: number }>();
  for (const r of runs) {
    scheduled += Math.max(0, r.run.steps - fromStep + 1);
    for (const s of r.steps) {
      const step = s.stepIndex + 1;
      if (step < fromStep) continue;
      withRecord++;
      if (s.acceptance?.status === 'ran') ran++;
      const reason = notPassingReason(s);
      const ps = perStep.get(step) ?? { n: 0, pass: 0 };
      ps.n++;
      if (reason === null) {
        passing++;
        ps.pass++;
      } else byStatus[reason] = (byStatus[reason] ?? 0) + 1;
      perStep.set(step, ps);
    }
  }
  const passRateByStep: Record<string, number | null> = {};
  for (const step of [...perStep.keys()].sort((a, b) => a - b)) {
    const ps = perStep.get(step) ?? { n: 0, pass: 0 };
    passRateByStep[String(step)] = ps.n === 0 ? null : round(ps.pass / ps.n);
  }
  return {
    stepsScheduled: scheduled,
    stepsWithRecord: withRecord,
    stepsRan: ran,
    stepsPassing: passing,
    passRate: withRecord === 0 ? null : round(passing / withRecord),
    coverage: withRecord === 0 ? null : round(ran / withRecord),
    byStatus: sortKeys(byStatus),
    passRateByStep,
  };
}

export interface AcceptanceGap {
  readonly blocks: number;
  /** 100 × (passRate[reference] − passRate[treated]) over the paired blocks; null with no paired block. */
  readonly gapPoints: number | null;
  readonly absGapPoints: number | null;
  readonly bar: number;
  /** One-sided reading: the treated arm passes more than 10 points fewer. */
  readonly flag: boolean;
  /** Two-sided reading: the arms differ by more than 10 points. */
  readonly flagTwoSided: boolean;
}

function runRate(r: LoadedRun, fromStep: number): number | null {
  const steps = r.steps.filter((s) => s.stepIndex + 1 >= fromStep);
  if (steps.length === 0) return null;
  return steps.filter(stepPasses).length / steps.length;
}

/** The paired gap of a contrast `[reference, treated]`: only blocks that have both cells count (EV-03). */
export function acceptanceGap(byCell: ReadonlyMap<string, readonly LoadedRun[]>, contrast: readonly [string, string], fromStep: number): AcceptanceGap {
  const [ref, treated] = contrast;
  const index = (cell: string): Map<string, LoadedRun> => new Map((byCell.get(cell) ?? []).map((r) => [blockKey(r.run), r]));
  const a = index(ref);
  const b = index(treated);
  let n = 0;
  let sumRef = 0;
  let sumTreated = 0;
  for (const [key, ra] of [...a].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))) {
    const rb = b.get(key);
    if (rb === undefined) continue;
    const pa = runRate(ra, fromStep);
    const pb = runRate(rb, fromStep);
    if (pa === null || pb === null) continue;
    n++;
    sumRef += pa;
    sumTreated += pb;
  }
  const gap = n === 0 ? null : round((100 * (sumRef - sumTreated)) / n);
  const abs = gap === null ? null : Math.abs(gap);
  return {
    blocks: n,
    gapPoints: gap,
    absGapPoints: abs,
    bar: ACCEPTANCE_BAR_POINTS,
    flag: gap !== null && gap > ACCEPTANCE_BAR_POINTS,
    flagTwoSided: abs !== null && abs > ACCEPTANCE_BAR_POINTS,
  };
}

export function sortKeys<T>(o: Readonly<Record<string, T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k] as T;
  return out;
}
