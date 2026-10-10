/**
 * Neural aggregation for scoring (ADR-028 Option C; `Docs/analysis-plan.md` §12).
 *
 * - `registered` (default, primary): the registered rule. U4's `majority-of-valid-units-v1` function verdict, and a
 *   `fail` contributes the U3 confidence weight of the function confidence to its dimension's `violatedWeight`
 *   (BR-U3-32); `pass` and `warning` contribute 0.
 * - `proportional` (registered sensitivity analysis, `proportional-inclusion-weighted-v1`): the function contributes
 *   the inclusion-weighted share of failed judged units. The judged units of a function are a layer-stratified sample
 *   of its candidate units (seeded round-robin over layers with a cap, BR-U4-SEL-04), so each valid unit u of layer h
 *   weighs `w_u = N_h / V_h` (N_h candidate units of layer h, V_h valid judged units of layer h). A failed unit scores
 *   the U3 confidence weight of its own confidence (1.0 / 0.7 / 0.3 by the spec's confidence thresholds, 0.2 when
 *   flagged unstable); a passing unit and a split-vote (`warning`) unit score 0. Invalid units are left out and their
 *   layer re-weighted; a layer without a valid unit drops out of both sums.
 *
 *   share = Σ_h N_h · ȳ_h / Σ_{h: V_h > 0} N_h,   ȳ_h = mean over the valid units of layer h of their score.
 *
 *   Uncapped and all valid, every weight is 1 and the share is the plain mean. Whether a function has a result at
 *   all (AGG-05 too few valid units, AGG-09 no units) is unchanged, so `functionCount` is the same under both rules.
 *   Hash order inside a layer is treated as simple random sampling; no variance is reported.
 * - The variant is UNDEFINED for a run that reuses a baseline selection (BR-U4-SEL-07, `selection.source =
 *   'baseline'`): its `addedByVariant` units are judged with probability 1, so N_h / V_h is not an inclusion weight.
 *   The scorer refuses such a run (`NEURAL_AGGREGATION_UNDEFINED`) and the re-scorer emits no proportional row.
 * - Asymmetry (bias toward clean): a failed unit scores at most 1 and is discounted by its confidence, a passing unit
 *   scores 0 whatever its confidence, so low-confidence fails pull the share down and never up. The confidence-free
 *   share `Σ N_h · failed_h / V_h / Σ N_h` (`confidenceFreeShare`) is reported beside it.
 * Pure: no I/O.
 */
import type { ConfidenceThresholds } from '../shared/types/spec.js';

export type NeuralAggregation = 'registered' | 'proportional';
export const NEURAL_AGGREGATIONS: readonly NeuralAggregation[] = Object.freeze(['registered', 'proportional']);
export const DEFAULT_NEURAL_AGGREGATION: NeuralAggregation = 'registered';
/** Rule id of the variant, as registered in `corpus/frozen-instrument.json` `scoringFreeze.neuralAggregation`. */
export const PROPORTIONAL_RULE_ID = 'proportional-inclusion-weighted-v1' as const;

/** The variant is defined only for a function that selected its own units (not SEL-07 baseline reuse). */
export function proportionalDefinedFor(selection: { readonly source?: 'own' | 'baseline' | undefined } | undefined): boolean {
  return selection?.source !== 'baseline';
}

export function parseNeuralAggregation(value: string | undefined): NeuralAggregation | undefined {
  if (value === undefined) return DEFAULT_NEURAL_AGGREGATION;
  return (NEURAL_AGGREGATIONS as readonly string[]).includes(value) ? (value as NeuralAggregation) : undefined;
}

/** U3 confidence weight (BR-U3-32): unstable 0.2; else 1.0 at or above `high`, 0.7 at or above `medium`, else 0.3. */
export function confidenceWeight(confidence: number, unstable: boolean, thresholds?: ConfidenceThresholds): number {
  if (unstable) return 0.2;
  const high = thresholds?.high ?? 0.85;
  const medium = thresholds?.medium ?? 0.6;
  if (confidence >= high) return 1.0;
  if (confidence >= medium) return 0.7;
  return 0.3;
}

/** What the variant reads of one judged unit (a `JudgeUnitResult` or a persisted `NeuralUnitRow`). */
export interface ProportionalUnit {
  readonly layer?: string | undefined;
  readonly status?: 'valid' | 'invalid' | undefined;
  readonly verdict: 'pass' | 'fail' | 'warning';
  readonly confidence: number;
  readonly flaggedUnstable?: boolean | undefined;
}

export interface ProportionalStratum {
  readonly layer: string;
  readonly candidates: number;   // N_h
  readonly validUnits: number;   // V_h
  readonly failedUnits: number;
  readonly meanScore: number;    // ȳ_h (0 when V_h = 0)
}

export interface ProportionalShare {
  readonly share: number;
  /** Σ N_h · failed_h / V_h / Σ N_h: the same Hájek share with every failed unit scoring 1 (no confidence weight). */
  readonly confidenceFreeShare: number;
  readonly strata: readonly ProportionalStratum[];   // sorted by layer
  readonly validUnits: number;
  readonly failedUnits: number;
  readonly warningUnits: number;
}

/**
 * The variant's share for one function. `candidatesByLayer` holds N_h; a layer of a valid unit that it lacks, or with
 * fewer candidates than judged units, takes N_h = the judged units of that layer (weight 1). `undefined` when the
 * function has no valid unit (U4 then emits no result).
 */
export function proportionalShare(
  units: readonly ProportionalUnit[],
  candidatesByLayer: Readonly<Record<string, number>> | undefined,
  thresholds?: ConfidenceThresholds,
): ProportionalShare | undefined {
  const judgedByLayer = new Map<string, number>();
  const byLayer = new Map<string, { valid: number; failed: number; scoreSum: number }>();
  let warningUnits = 0;
  for (const u of units) {
    const layer = u.layer ?? '';
    judgedByLayer.set(layer, (judgedByLayer.get(layer) ?? 0) + 1);
    if ((u.status ?? 'valid') !== 'valid') continue;
    const s = byLayer.get(layer) ?? { valid: 0, failed: 0, scoreSum: 0 };
    s.valid++;
    if (u.verdict === 'fail') {
      s.failed++;
      s.scoreSum += confidenceWeight(u.confidence, u.flaggedUnstable ?? false, thresholds);
    } else if (u.verdict === 'warning') {
      warningUnits++;
    }
    byLayer.set(layer, s);
  }
  const validUnits = [...byLayer.values()].reduce((a, s) => a + s.valid, 0);
  if (validUnits === 0) return undefined;
  const layers = [...new Set([...judgedByLayer.keys(), ...Object.keys(candidatesByLayer ?? {})])].sort();
  const strata: ProportionalStratum[] = [];
  let num = 0;
  let numFree = 0;
  let den = 0;
  for (const layer of layers) {
    const judged = judgedByLayer.get(layer) ?? 0;
    const s = byLayer.get(layer) ?? { valid: 0, failed: 0, scoreSum: 0 };
    const candidates = Math.max(candidatesByLayer?.[layer] ?? 0, judged);
    const meanScore = s.valid === 0 ? 0 : s.scoreSum / s.valid;
    strata.push({ layer, candidates, validUnits: s.valid, failedUnits: s.failed, meanScore });
    if (s.valid === 0) continue;
    num += candidates * meanScore;
    numFree += candidates * (s.failed / s.valid);
    den += candidates;
  }
  const failedUnits = strata.reduce((a, s) => a + s.failedUnits, 0);
  return { share: num / den, confidenceFreeShare: numFree / den, strata, validUnits, failedUnits, warningUnits };
}
