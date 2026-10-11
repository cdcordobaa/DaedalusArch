/**
 * SO4 baseline precision (ADR-020 item 1; `Docs/analysis-plan.md` §3; BR-U5b-61 interval rule).
 *
 * The seeded differential precision of `Docs/matching-rule.md` only sees new violations of seeded copies, most of
 * them neutralised as predicted collateral, so it is close to 1 by construction. The registered secondary outcome
 * here is the instrument's precision on real code: the Horvitz–Thompson weighted share of the P2 baseline items
 * (corpus baseline violations, sampled per (project, function) stratum with inclusion probability p) whose reconciled
 * label is TP-class (`TP` or `unseeded-TP`), each item weighing 1 / p. `uncertain` items stay in the denominator as
 * non-TP (the MAT-10 convention) and are counted. Clusters are projects; per function, per corpus tier and per
 * project rows are reported beside the overall row.
 *
 * Instrument versions (ADR-026; analysis plan §10 B8): the P2 labels come from two frames, split by the `v1-only: `
 * stratum prefix (`p2FrameOf`). The **v2 rows** (overall, tier, function, project) use the v2-population labels only,
 * so no exempted row enters them. When v1-only labels exist, one **v1** overall row (both frames, each label weighing
 * 1 / p of its own frame, over v2 ∪ v1-only) and one **v1-only** overall row (counts only, never an interval) follow.
 *
 * Sensitivity to the `uncertain` rule (reproduction audit 2026-10-10 issue 3; POST-HOC, analysis plan §11): after the
 * registered rows (`uncertainRule` `fp`, `uncertain` kept in the denominator as non-TP), the v2 overall and tier rows
 * and the v1 overall row are repeated with `uncertain` counted as TP (`tp`) and with `uncertain` items dropped
 * (`excluded`). They are sensitivity rows only; every `precision_baseline` column and figure uses the registered rows.
 * `planIds` names the plans whose runs the row's labels were drawn from (from the label `runId`), so a row is filed
 * under its population (the `e7-corpus` runs, and `e7-corpus-v1sym` for the v1-only frame), not under the plan that
 * aggregates it.
 *
 * Pure functions only; the interval is `weightedProportionInterval` (Kish-Wilson below 10 clusters).
 */
import { p2FrameOf } from './label-plan.js';
import type { P2Frame } from './label-plan.js';
import type { CorpusTier } from './mutation/types.js';
import { weightedProportionInterval } from './stats.js';
import type { WeightedCiMethod, WeightedObservation } from './stats.js';

/** Labels counted as true positives in every precision and HT estimate (ADR-020 item 2; MAT-10 1.1.0). */
export const TP_CLASS_LABELS: readonly string[] = Object.freeze(['TP', 'unseeded-TP']);

export function isTpClass(label: string): boolean {
  return TP_CLASS_LABELS.includes(label);
}

/** One reconciled P2 label. */
export interface BaselineLabel {
  readonly projectId: string;
  readonly functionId: string;
  readonly label: string;
  readonly inclusionProbability: number;
  /** The P2 frame of the label's stratum (`p2FrameOf`); absent = `v2`. */
  readonly frame?: P2Frame;
  /** The plan of the run the item was drawn from (`planIdOfRunId` of the label's `runId`); absent when unknown. */
  readonly planId?: string;
}

/** The fields of a reconciled label (`ReconciledLabel` of `scripts/llm-label.ts`) this module reads. */
export interface ReconciledLabelView {
  readonly population: string;
  readonly kind: string;
  readonly projectId: string;
  readonly stratum: string;
  readonly inclusionProbability: number;
  readonly label: string;
  readonly functionId?: string;
  readonly runId?: string;
}

/** How a row counts `uncertain` labels: as non-TP in the denominator (`fp`, registered), as TP, or not at all. */
export type UncertainRule = 'fp' | 'tp' | 'excluded';

/** The plan id of a harness run id (`<planId>-<NNN>-<projectId>`, `runIdOf` of `run-experiment.ts`), else `undefined`. */
export function planIdOfRunId(runId: string): string | undefined {
  return /^(.+?)-\d{3}-/.exec(runId)?.[1];
}

export type BaselineScope = 'overall' | 'tier' | 'function' | 'project';

/** The instrument version of a row (B8): the v2 population, v2 ∪ v1-only (v1), or the v1-only set alone. */
export type BaselineInstrument = 'v2' | 'v1' | 'v1-only';

export interface BaselinePrecisionRow {
  readonly instrument: BaselineInstrument;
  readonly scope: BaselineScope;
  /** `''` (overall), the corpus tier, the function id or the project id. */
  readonly key: string;
  readonly n: number;
  readonly nTpClass: number;
  readonly nUncertain: number;
  readonly weightedTpClass: number;
  readonly weightedTotal: number;
  readonly nEffective: number;
  readonly nClusters: number;
  /** `null` when n < 10 (counts only, BR-U5b-61). */
  readonly estimate: number | null;
  readonly ciLow: number | null;
  readonly ciHigh: number | null;
  readonly ciMethod: WeightedCiMethod | null;
  /** `fp` on the registered rows; `tp` and `excluded` on the post-hoc sensitivity rows. */
  readonly uncertainRule: UncertainRule;
  /** Sorted plan ids of the labels' runs (empty when no label carries a run id). */
  readonly planIds: readonly string[];
}

export const BASELINE_PRECISION_INVALID = 'BASELINE_PRECISION_INVALID';

/** The function id of a `'<project>, <function>'` violation stratum (BR-U5b-33), else `undefined`. */
export function stratumFunctionId(stratum: string): string | undefined {
  const at = stratum.lastIndexOf(', ');
  if (at < 0) return undefined;
  const f = stratum.slice(at + 2);
  return f === '' ? undefined : f;
}

/** The P2 violation labels of a reconciled label list; the function id comes from the label or its stratum. */
export function baselineLabelsOf(labels: readonly ReconciledLabelView[]): BaselineLabel[] {
  return labels.filter((l) => l.population === 'P2' && l.kind === 'violation').map((l) => {
    const functionId = l.functionId ?? stratumFunctionId(l.stratum);
    if (functionId === undefined) throw new Error(`${BASELINE_PRECISION_INVALID}: P2 stratum without a function id: ${l.stratum}`);
    const planId = l.runId === undefined ? undefined : planIdOfRunId(l.runId);
    return { projectId: l.projectId, functionId, label: l.label, inclusionProbability: l.inclusionProbability, frame: p2FrameOf(l.stratum), ...(planId !== undefined && { planId }) };
  });
}

function weightOf(l: BaselineLabel): number {
  const p = l.inclusionProbability;
  if (!(p > 0 && p <= 1)) throw new Error(`${BASELINE_PRECISION_INVALID}: inclusion probability ${String(p)} for ${l.functionId} in ${l.projectId}`);
  return 1 / p;
}

function rowOf(
  instrument: BaselineInstrument, scope: BaselineScope, key: string, all: readonly BaselineLabel[], seed: number, resamples: number | undefined,
  uncertainRule: UncertainRule = 'fp',
): BaselinePrecisionRow {
  const labels = uncertainRule === 'excluded' ? all.filter((l) => l.label !== 'uncertain') : all;
  const success = (l: BaselineLabel): boolean => isTpClass(l.label) || (uncertainRule === 'tp' && l.label === 'uncertain');
  const byProject = new Map<string, WeightedObservation[]>();
  for (const l of labels) byProject.set(l.projectId, [...(byProject.get(l.projectId) ?? []), { weight: weightOf(l), success: success(l) }]);
  const clusters = [...byProject.keys()].sort().map((p) => byProject.get(p) ?? []);
  const cell = weightedProportionInterval(clusters, { seed, ...(resamples !== undefined && { resamples }) });
  return {
    instrument, scope, key, n: cell.n, nTpClass: labels.filter((l) => isTpClass(l.label)).length, nUncertain: labels.filter((l) => l.label === 'uncertain').length,
    weightedTpClass: cell.weightedSuccesses, weightedTotal: cell.weightedTotal, nEffective: cell.nEffective, nClusters: cell.nClusters,
    estimate: cell.estimate, ciLow: cell.ciLow, ciHigh: cell.ciHigh, ciMethod: cell.ciMethod,
    uncertainRule, planIds: [...new Set(all.flatMap((l) => (l.planId === undefined ? [] : [l.planId])))].sort(),
  };
}

/**
 * Baseline precision rows: the v2 rows (overall, per corpus tier when `tierOf` knows the project, per function and per
 * project, each in sorted key order) over the v2-population labels only; then, when v1-only labels exist, the v1
 * overall row (all labels) and the v1-only overall row (counts only). An empty label list yields no row.
 */
export function baselinePrecision(
  all: readonly BaselineLabel[],
  options: { readonly seed: number; readonly resamples?: number; readonly tierOf?: (projectId: string) => CorpusTier | undefined },
): BaselinePrecisionRow[] {
  if (all.length === 0) return [];
  const { seed, resamples } = options;
  const v1Only = all.filter((l) => l.frame === 'v1-only');
  const labels = all.filter((l) => l.frame !== 'v1-only');
  const group = (by: (l: BaselineLabel) => string | undefined): Map<string, BaselineLabel[]> => {
    const m = new Map<string, BaselineLabel[]>();
    for (const l of labels) {
      const k = by(l);
      if (k !== undefined) m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  };
  const rows: BaselinePrecisionRow[] = labels.length === 0 ? [] : [rowOf('v2', 'overall', '', labels, seed, resamples)];
  for (const [scope, by] of [
    ['tier', (l: BaselineLabel): string | undefined => options.tierOf?.(l.projectId)],
    ['function', (l: BaselineLabel): string => l.functionId],
    ['project', (l: BaselineLabel): string => l.projectId],
  ] as const) {
    const g = group(by);
    for (const k of [...g.keys()].sort()) rows.push(rowOf('v2', scope, k, g.get(k) ?? [], seed, resamples));
  }
  if (v1Only.length > 0) {
    rows.push(rowOf('v1', 'overall', '', all, seed, resamples));
    const only = rowOf('v1-only', 'overall', '', v1Only, seed, resamples);
    rows.push({ ...only, estimate: null, ciLow: null, ciHigh: null, ciMethod: null });
  }
  // Post-hoc sensitivity rows (audit 2026-10-10 issue 3): the overall, tier and v1 rows under the other two rules.
  const tiers = group((l) => options.tierOf?.(l.projectId));
  for (const rule of ['tp', 'excluded'] as const) {
    if (labels.length > 0) rows.push(rowOf('v2', 'overall', '', labels, seed, resamples, rule));
    for (const k of [...tiers.keys()].sort()) rows.push(rowOf('v2', 'tier', k, tiers.get(k) ?? [], seed, resamples, rule));
    if (v1Only.length > 0) rows.push(rowOf('v1', 'overall', '', all, seed, resamples, rule));
  }
  return rows;
}
