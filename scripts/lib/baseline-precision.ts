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
 * Pure functions only; the interval is `weightedProportionInterval` (Kish-Wilson below 10 clusters).
 */
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
}

export type BaselineScope = 'overall' | 'tier' | 'function' | 'project';

export interface BaselinePrecisionRow {
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
    return { projectId: l.projectId, functionId, label: l.label, inclusionProbability: l.inclusionProbability };
  });
}

function weightOf(l: BaselineLabel): number {
  const p = l.inclusionProbability;
  if (!(p > 0 && p <= 1)) throw new Error(`${BASELINE_PRECISION_INVALID}: inclusion probability ${String(p)} for ${l.functionId} in ${l.projectId}`);
  return 1 / p;
}

function rowOf(scope: BaselineScope, key: string, labels: readonly BaselineLabel[], seed: number, resamples: number | undefined): BaselinePrecisionRow {
  const byProject = new Map<string, WeightedObservation[]>();
  for (const l of labels) byProject.set(l.projectId, [...(byProject.get(l.projectId) ?? []), { weight: weightOf(l), success: isTpClass(l.label) }]);
  const clusters = [...byProject.keys()].sort().map((p) => byProject.get(p) ?? []);
  const cell = weightedProportionInterval(clusters, { seed, ...(resamples !== undefined && { resamples }) });
  return {
    scope, key, n: cell.n, nTpClass: labels.filter((l) => isTpClass(l.label)).length, nUncertain: labels.filter((l) => l.label === 'uncertain').length,
    weightedTpClass: cell.weightedSuccesses, weightedTotal: cell.weightedTotal, nEffective: cell.nEffective, nClusters: cell.nClusters,
    estimate: cell.estimate, ciLow: cell.ciLow, ciHigh: cell.ciHigh, ciMethod: cell.ciMethod,
  };
}

/**
 * Baseline precision rows: overall, per corpus tier (when `tierOf` knows the project), per function and per project,
 * each in sorted key order. An empty label list yields no row.
 */
export function baselinePrecision(
  labels: readonly BaselineLabel[],
  options: { readonly seed: number; readonly resamples?: number; readonly tierOf?: (projectId: string) => CorpusTier | undefined },
): BaselinePrecisionRow[] {
  if (labels.length === 0) return [];
  const { seed, resamples } = options;
  const group = (by: (l: BaselineLabel) => string | undefined): Map<string, BaselineLabel[]> => {
    const m = new Map<string, BaselineLabel[]>();
    for (const l of labels) {
      const k = by(l);
      if (k !== undefined) m.set(k, [...(m.get(k) ?? []), l]);
    }
    return m;
  };
  const rows: BaselinePrecisionRow[] = [rowOf('overall', '', labels, seed, resamples)];
  for (const [scope, by] of [
    ['tier', (l: BaselineLabel): string | undefined => options.tierOf?.(l.projectId)],
    ['function', (l: BaselineLabel): string => l.functionId],
    ['project', (l: BaselineLabel): string => l.projectId],
  ] as const) {
    const g = group(by);
    for (const k of [...g.keys()].sort()) rows.push(rowOf(scope, k, g.get(k) ?? [], seed, resamples));
  }
  return rows;
}
