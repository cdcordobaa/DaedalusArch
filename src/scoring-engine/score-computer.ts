import type { EvaluationResults, SymbolicFunctionResult, NeuronalFunctionResult, PerDimensionScore } from '../shared/types/evaluation.js';
import type { Dimension, EvaluationMode } from '../shared/types/enums.js';
import type { ScoringWeights, ConfidenceThresholds } from '../shared/types/spec.js';
import { avrScore, ahsScore } from '../shared/types/value-objects.js';
import type { AVRScore, AHSScore } from '../shared/types/value-objects.js';

const ALL_DIMENSIONS: Dimension[] = ['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'intent'];
const SYMBOLIC_DIMENSIONS: Dimension[] = ['structural', 'coupling', 'pattern', 'solid', 'convention'];

/**
 * Compute AVR for a single dimension.
 * AVR = violated / total. 0 if no functions in dimension.
 */
export function computeAVR(
  symbolicResults: readonly SymbolicFunctionResult[],
  neuronalResults: readonly NeuronalFunctionResult[],
  dimension: Dimension,
  confidenceThresholds?: ConfidenceThresholds,
): AVRScore {
  let totalFunctions = 0;
  let violatedFunctions = 0;

  // Symbolic results: violations carry dimension
  for (const r of symbolicResults) {
    const hasDimViolation = r.violations.some((v) => v.dimension === dimension);
    if (hasDimViolation) {
      totalFunctions++;
      if (!r.passed) violatedFunctions++;
    }
  }

  // Neuronal results: carry dimension directly
  for (const r of neuronalResults) {
    // NeuronalFunctionResult doesn't have dimension directly — but violations do
    const hasDimViolation = r.violations.some((v) => v.dimension === dimension);
    const isDimResult = hasDimViolation || (r.violations.length === 0 && dimension === 'intent');
    if (isDimResult) {
      totalFunctions++;
      // Apply confidence calibration
      if (r.verdict === 'fail') {
        const weight = getConfidenceWeight(r.confidence, r.flaggedUnstable, confidenceThresholds);
        violatedFunctions += weight;
      }
    }
  }

  if (totalFunctions === 0) return avrScore(0);
  return avrScore(Math.min(1, Math.round((violatedFunctions / totalFunctions) * 1000) / 1000));
}

/**
 * Compute AHS from per-dimension AVRs and weights.
 * AHS = Σ(w_d × (1 - AVR_d))
 */
export function computeAHS(
  avrs: ReadonlyMap<Dimension, AVRScore>,
  weights: ScoringWeights,
): AHSScore {
  let score = 0;
  const weightMap: Record<string, number> = {
    structural: weights.structural,
    coupling: weights.coupling,
    pattern: weights.pattern,
    solid: weights.solid,
    convention: weights.convention,
    semantic: weights.semantic,
    intent: weights.intent,
  };

  for (const [dim, avr] of avrs) {
    const w = weightMap[dim] ?? 0;
    score += w * (1 - Number(avr));
  }

  return ahsScore(Math.round(score * 1000) / 1000);
}

/**
 * Compute per-dimension scores.
 */
export function computePerDimensionScores(
  results: EvaluationResults,
  weights: ScoringWeights,
  mode: EvaluationMode,
  confidenceThresholds?: ConfidenceThresholds,
): { scores: PerDimensionScore[]; avrs: Map<Dimension, AVRScore> } {
  const dimensions = mode === 'neuronal-only'
    ? ['semantic', 'intent'] as Dimension[]
    : mode === 'symbolic-only'
      ? SYMBOLIC_DIMENSIONS
      : ALL_DIMENSIONS;

  const weightMap: Record<string, number> = {
    structural: weights.structural,
    coupling: weights.coupling,
    pattern: weights.pattern,
    solid: weights.solid,
    convention: weights.convention,
    semantic: weights.semantic,
    intent: weights.intent,
  };

  const avrs = new Map<Dimension, AVRScore>();
  const scores: PerDimensionScore[] = [];

  for (const dim of dimensions) {
    const avr = computeAVR(results.symbolicResults, results.neuronalResults, dim, confidenceThresholds);
    avrs.set(dim, avr);

    // Count functions and violations
    const symViolations = results.symbolicResults.filter((r) => !r.passed && r.violations.some((v) => v.dimension === dim));
    const neurViolations = results.neuronalResults.filter((r) => r.verdict === 'fail' && r.violations.some((v) => v.dimension === dim));

    scores.push({
      dimension: dim,
      avr,
      weight: weightMap[dim] ?? 0,
      violationCount: symViolations.length + neurViolations.length,
      functionCount: results.symbolicResults.length + results.neuronalResults.length, // approximate
    });
  }

  return { scores, avrs };
}

function getConfidenceWeight(
  confidence: number,
  unstable: boolean,
  thresholds?: ConfidenceThresholds,
): number {
  if (unstable) return 0.2;
  const high = thresholds?.high ?? 0.85;
  const medium = thresholds?.medium ?? 0.60;
  if (confidence >= high) return 1.0;
  if (confidence >= medium) return 0.7;
  return 0.3;
}
