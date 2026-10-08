/**
 * Weight renormalisation and dimension accounting (C8; FR-15, FR-26; U3 BR-U3-33, 34, 35, 39).
 *
 * `renormaliseWeights` is exported from the scoring-engine index so U5b can recompute every AHS
 * variant from `report.scoring` and the rows' `functionCount` (FR-26). Effective weights are
 * stored unrounded; only the AHS is rounded (three decimals).
 */
import type { Dimension } from '../shared/types/enums.js';
import type { DroppedReason } from '../shared/types/evaluation.js';
import type { FunctionId } from '../shared/types/value-objects.js';

/** Per-dimension counts (a missing key is 0). */
export type DimensionCounts = Readonly<Partial<Record<Dimension, number>>>;

/** Per-dimension weights (a missing key is 0); `ScoringWeights` fits. */
export type DimensionWeights = Readonly<Partial<Record<Dimension, number>>>;

export interface DroppedCandidate {
  readonly dimension: Dimension;
  readonly declared: number;
  readonly disabled: number;
}

export interface RenormalisedWeights {
  /** Unrounded `weight(d) / Σ weight(e)` over the executed dimensions; executed dimensions only. */
  readonly effectiveWeights: DimensionWeights;
  /** Candidate dimensions with `executed > 0`, in `dimensions` order. */
  readonly executedDimensions: readonly Dimension[];
  /** Candidate dimensions with `executed = 0`, in `dimensions` order (reason: `dropReasonFor`). */
  readonly dropped: readonly DroppedCandidate[];
  /** Σ configured weight over the executed dimensions; 0 means `SCORING_NO_EXECUTED_WEIGHT` (BR-U3-37). */
  readonly executedWeight: number;
}

/**
 * BR-U3-33: `effectiveWeight(d) = weight(d) / Σ_{e ∈ dimensions, executed(e) > 0} weight(e)` for the
 * executed candidate dimensions; the others are dropped. `dimensions` are the candidate (in-mode)
 * dimensions of the AHS variant (domain-entities.md §4.2): out-of-mode dimensions are never
 * dropped. When the executed weight is 0 no effective weight is produced.
 */
export function renormaliseWeights(
  weights: DimensionWeights,
  executed: DimensionCounts,
  declared: DimensionCounts,
  disabled: DimensionCounts,
  dimensions: readonly Dimension[],
): RenormalisedWeights {
  const executedDimensions = dimensions.filter((d) => (executed[d] ?? 0) > 0);
  const dropped = dimensions
    .filter((d) => (executed[d] ?? 0) <= 0)
    .map((dimension) => ({ dimension, declared: declared[dimension] ?? 0, disabled: disabled[dimension] ?? 0 }));
  const executedWeight = executedDimensions.reduce((sum, d) => sum + (weights[d] ?? 0), 0);
  const effectiveWeights: Partial<Record<Dimension, number>> = {};
  if (executedWeight > 0) {
    for (const d of executedDimensions) effectiveWeights[d] = (weights[d] ?? 0) / executedWeight;
  }
  return { effectiveWeights, executedDimensions, dropped, executedWeight };
}

/** `round3(1 − Σ_d effectiveWeight(d) × avr(d))` (BR-U3-35); a dimension without an AVR contributes 0. */
export function ahsFromEffectiveWeights(effectiveWeights: DimensionWeights, avr: DimensionWeights): number {
  let violated = 0;
  for (const [dimension, weight] of Object.entries(effectiveWeights) as [Dimension, number | undefined][]) {
    violated += (weight ?? 0) * (avr[dimension] ?? 0);
  }
  return Math.round((1 - violated) * 1000) / 1000;
}

export interface DimensionDeclaration {
  /** Spec functions declared in the dimension, enabled or not. */
  readonly declared: number;
  /** Declared functions of the dimension that are disabled (compiled `disabledFunctions`). */
  readonly disabled: number;
  /** Ids of the declared, non-disabled functions of the dimension. */
  readonly activeFunctionIds: readonly (FunctionId | string)[];
}

/**
 * Reason a candidate dimension with no executed function is dropped (BR-U3-34), first match wins:
 * `none_declared` (declared 0) → `disabled_by_spec` (every declared function disabled) →
 * `no-judge-units` (every declared, non-disabled function is in `noJudgeUnits`) →
 * `execution_failure`.
 */
export function dropReasonFor(
  dimension: Dimension,
  counts: Readonly<Partial<Record<Dimension, DimensionDeclaration>>>,
  noJudgeUnits: readonly (FunctionId | string)[],
): DroppedReason {
  const entry = counts[dimension];
  if (entry === undefined || entry.declared <= 0) return 'none_declared';
  if (entry.disabled >= entry.declared) return 'disabled_by_spec';
  const noUnits = new Set(noJudgeUnits.map(String));
  if (entry.activeFunctionIds.length > 0 && entry.activeFunctionIds.every((id) => noUnits.has(String(id)))) {
    return 'no-judge-units';
  }
  return 'execution_failure';
}
