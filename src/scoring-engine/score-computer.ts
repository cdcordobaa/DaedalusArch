/**
 * Dimension accounting and AHS variants (C8; FR-15, FR-32; U3 BR-U3-30..39, business-logic-model.md §6).
 *
 * Every executed function counts once in its own dimension (a hybrid pair counts once); results of a
 * function listed in `failures` never count (BR-U3-53). AVR = round3(violatedWeight / functionCount)
 * (BR-U3-32). Each AHS variant renormalises its weight map over the executed dimensions of its candidate
 * set (BR-U3-33, 35); rows carry the weights of the verdict-source variant (BR-U3-39).
 */
import type {
  DroppedDimension, EvaluationResults, NeuronalFunctionResult, PerDimensionScore, ReportScoring,
  SymbolicFunctionResult,
} from '../shared/types/evaluation.js';
import { DIMENSIONS, MODEL_JUDGED_DIMENSIONS, SYMBOLIC_DIMENSIONS } from '../shared/types/enums.js';
import type { Dimension, EvaluationMode } from '../shared/types/enums.js';
import type { ConfidenceThresholds, DisabledFunction, FitnessFunction, ScoringWeights } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import { avrScore, ahsScore } from '../shared/types/value-objects.js';
import type { AVRScore, AHSScore } from '../shared/types/value-objects.js';
import { ahsFromEffectiveWeights, dropReasonFor, renormaliseWeights } from './renormaliser.js';
import type { DimensionDeclaration, DimensionWeights, RenormalisedWeights } from './renormaliser.js';

export type VerdictSource = ReportScoring['verdictSource'];

/** Executed-function tally of one dimension (BR-U3-31, 32). */
export interface DimensionTally {
  /** Functions (not results) executed in the dimension; a hybrid pair counts once. */
  readonly functionCount: number;
  /** Unrounded AVR numerator: 1 per failed symbolic function, the confidence weight per neural `fail`. */
  readonly violatedWeight: number;
  /** Functions with a non-zero contribution. */
  readonly violationCount: number;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

/** In-mode (candidate) dimensions per mode (domain-entities.md §4.2). */
export function inModeDimensions(mode: EvaluationMode): readonly Dimension[] {
  switch (mode) {
    case 'symbolic-only':
      return SYMBOLIC_DIMENSIONS;
    case 'neuronal-only':
      return MODEL_JUDGED_DIMENSIONS;
    case 'full':
      return DIMENSIONS;
  }
}

/** Frozen verdict source per mode (BR-U3-36, BR-U3-70 item 4). */
export function verdictSourceOf(mode: EvaluationMode): VerdictSource {
  switch (mode) {
    case 'symbolic-only':
      return 'ahsDeterministic';
    case 'neuronal-only':
      return 'ahsNeuronal';
    case 'full':
      return 'ahsCombined';
  }
}

interface FunctionOutcome {
  dimension: Dimension;
  symbolic?: SymbolicFunctionResult;
  neural?: NeuronalFunctionResult;
}

/**
 * One entry per executed function id: results of failed functions are excluded (BR-U3-53), and a
 * hybrid symbolic half with `neuralSkipped` counts no neural result.
 */
function executedFunctions(results: EvaluationResults): Map<string, FunctionOutcome> {
  const failed = new Set((results.failures ?? []).map((f) => String(f.functionId)));
  const byId = new Map<string, FunctionOutcome>();
  for (const r of results.symbolicResults) {
    const id = String(r.functionId);
    if (failed.has(id)) continue;
    byId.set(id, { ...byId.get(id), dimension: r.dimension, symbolic: r });
  }
  for (const r of results.neuronalResults) {
    const id = String(r.functionId);
    if (failed.has(id)) continue;
    const prior = byId.get(id);
    if (prior?.symbolic?.neuralSkipped !== undefined) continue;
    byId.set(id, { ...prior, dimension: prior?.dimension ?? r.dimension, neural: r });
  }
  return byId;
}

/** Contribution of one function to its dimension's `violatedWeight` (BR-U3-32). */
function contributionOf(fn: FunctionOutcome, confidenceThresholds?: ConfidenceThresholds): number {
  if (fn.symbolic !== undefined && !fn.symbolic.passed) return 1;
  if (fn.neural?.verdict === 'fail') {
    return getConfidenceWeight(Number(fn.neural.confidence), fn.neural.flaggedUnstable, confidenceThresholds);
  }
  return 0;
}

/** Per-dimension tallies of the executed functions (BR-U3-31, 32); dimensions without one are absent. */
export function tallyDimensions(
  results: EvaluationResults,
  confidenceThresholds?: ConfidenceThresholds,
): ReadonlyMap<Dimension, DimensionTally> {
  const tallies = new Map<Dimension, { functionCount: number; violatedWeight: number; violationCount: number }>();
  for (const fn of executedFunctions(results).values()) {
    const t = tallies.get(fn.dimension) ?? { functionCount: 0, violatedWeight: 0, violationCount: 0 };
    const c = contributionOf(fn, confidenceThresholds);
    t.functionCount++;
    t.violatedWeight += c;
    if (c > 0) t.violationCount++;
    tallies.set(fn.dimension, t);
  }
  return tallies;
}

/** `round3(violatedWeight / functionCount)`, 0 for an empty dimension (BR-U3-32). */
export function avrOf(tally: DimensionTally | undefined): AVRScore {
  if (tally === undefined || tally.functionCount === 0) return avrScore(0);
  return avrScore(Math.min(1, round3(tally.violatedWeight / tally.functionCount)));
}

/**
 * AVR for a single dimension: only functions of that dimension count, passing or failing (BR-U3-31).
 */
export function computeAVR(
  symbolicResults: readonly SymbolicFunctionResult[],
  neuronalResults: readonly NeuronalFunctionResult[],
  dimension: Dimension,
  confidenceThresholds?: ConfidenceThresholds,
): AVRScore {
  return avrOf(tallyDimensions({ symbolicResults, neuronalResults }, confidenceThresholds).get(dimension));
}

/**
 * AHS from per-dimension AVRs: `round3(1 − Σ effectiveWeight(d) × avr(d))`, the weights renormalised
 * over the dimensions present in `avrs` (BR-U3-33, 35). 1 when no present dimension carries weight.
 */
export function computeAHS(avrs: ReadonlyMap<Dimension, AVRScore>, weights: ScoringWeights): AHSScore {
  const dims = [...avrs.keys()];
  const executed = Object.fromEntries(dims.map((d) => [d, 1]));
  const { effectiveWeights } = renormaliseWeights(weights, executed, {}, {}, dims);
  const avr = Object.fromEntries([...avrs].map(([d, a]) => [d, Number(a)]));
  return ahsScore(ahsFromEffectiveWeights(effectiveWeights, avr));
}

export interface DimensionScoringInput {
  readonly evaluationResults: EvaluationResults;
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly confidenceThresholds?: ConfidenceThresholds;
  readonly mode: EvaluationMode;
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly disabledFunctions: readonly DisabledFunction[];
  readonly noJudgeUnits: readonly (FunctionId | string)[];
}

export type DimensionScoringErrorCode = 'SCORING_NO_EXECUTED_WEIGHT' | 'CONFIG_MISSING_FULL_MODE_WEIGHTS';

export interface DimensionScoring {
  readonly perDimensionScores: readonly PerDimensionScore[];
  readonly droppedDimensions: readonly DroppedDimension[];
  readonly ahsDeterministic?: AHSScore;
  readonly ahsCombined?: AHSScore;
  readonly ahsNeuronal?: AHSScore;
  readonly verdictSource: VerdictSource;
}

export type DimensionScoringResult =
  | { readonly ok: true; readonly value: DimensionScoring }
  | { readonly ok: false; readonly code: DimensionScoringErrorCode; readonly message: string };

/** Declared, disabled and active ids per dimension from the spec (BR-U3-34). */
function declarationsByDimension(
  fitnessFunctions: readonly FitnessFunction[],
  disabledFunctions: readonly DisabledFunction[],
): Partial<Record<Dimension, DimensionDeclaration>> {
  const disabled = new Set(disabledFunctions.map((d) => String(d.id)));
  const out: Partial<Record<Dimension, { declared: number; disabled: number; activeFunctionIds: string[] }>> = {};
  for (const f of fitnessFunctions) {
    const e = out[f.dimension] ?? { declared: 0, disabled: 0, activeFunctionIds: [] };
    e.declared++;
    if (disabled.has(String(f.id))) e.disabled++;
    else e.activeFunctionIds.push(String(f.id));
    out[f.dimension] = e;
  }
  return out;
}

/**
 * Scores every dimension and AHS variant of the mode (business-logic-model.md §6 steps 1–7).
 * Fails with `CONFIG_MISSING_FULL_MODE_WEIGHTS` (full / neuronal-only without full-mode weights) or
 * `SCORING_NO_EXECUTED_WEIGHT` (the verdict-source variant has no executed weight); no score is produced.
 */
export function scoreDimensions(input: DimensionScoringInput): DimensionScoringResult {
  const { mode } = input;
  if (mode !== 'symbolic-only' && input.fullModeWeights === undefined) {
    return {
      ok: false,
      code: 'CONFIG_MISSING_FULL_MODE_WEIGHTS',
      message: `${mode} mode needs scoring.full_mode_weights; no score is produced`,
    };
  }

  const tallies = tallyDimensions(input.evaluationResults, input.confidenceThresholds);
  const executed: Partial<Record<Dimension, number>> = {};
  const avr: Partial<Record<Dimension, number>> = {};
  for (const [d, t] of tallies) {
    executed[d] = t.functionCount;
    avr[d] = Number(avrOf(t));
  }
  const declarations = declarationsByDimension(input.fitnessFunctions, input.disabledFunctions);
  const declared = Object.fromEntries(Object.entries(declarations).map(([d, e]) => [d, e.declared]));
  const disabled = Object.fromEntries(Object.entries(declarations).map(([d, e]) => [d, e.disabled]));
  const variant = (weights: DimensionWeights, dims: readonly Dimension[]): RenormalisedWeights =>
    renormaliseWeights(weights, executed, declared, disabled, dims);

  const det = mode !== 'neuronal-only' ? variant(input.scoringWeights, SYMBOLIC_DIMENSIONS) : undefined;
  const combined = mode === 'full' && input.fullModeWeights !== undefined ? variant(input.fullModeWeights, DIMENSIONS) : undefined;
  const neuronal = mode !== 'symbolic-only' && input.fullModeWeights !== undefined
    ? variant(input.fullModeWeights, MODEL_JUDGED_DIMENSIONS)
    : undefined;

  const verdictSource = verdictSourceOf(mode);
  const source = verdictSource === 'ahsDeterministic' ? det : verdictSource === 'ahsCombined' ? combined : neuronal;
  const sourceWeights: DimensionWeights = verdictSource === 'ahsDeterministic' ? input.scoringWeights : input.fullModeWeights ?? {};
  if (source === undefined || tallies.size === 0 || source.executedWeight <= 0) {
    return {
      ok: false,
      code: 'SCORING_NO_EXECUTED_WEIGHT',
      message: `No executed in-mode weight for ${verdictSource} (${String(tallies.size)} dimensions executed); no score is produced`,
    };
  }

  const ahsOf = (v: RenormalisedWeights | undefined): AHSScore | undefined =>
    v !== undefined && v.executedWeight > 0 ? ahsScore(ahsFromEffectiveWeights(v.effectiveWeights, avr)) : undefined;

  const perDimensionScores: PerDimensionScore[] = [];
  for (const d of inModeDimensions(mode)) {
    const t = tallies.get(d);
    if (t === undefined || t.functionCount === 0) continue;
    perDimensionScores.push({
      dimension: d,
      avr: avrOf(t),
      violatedWeight: t.violatedWeight,
      weight: sourceWeights[d] ?? 0,
      effectiveWeight: source.effectiveWeights[d] ?? 0,
      violationCount: t.violationCount,
      functionCount: t.functionCount,
    });
  }

  // In-mode candidates with nothing executed (the verdict-source candidate set is the in-mode set).
  const droppedDimensions: DroppedDimension[] = source.dropped.map((c) => ({
    dimension: c.dimension,
    reason: dropReasonFor(c.dimension, declarations, input.noJudgeUnits),
    declared: c.declared,
    executed: 0,
  }));

  const ahsDeterministic = ahsOf(det);
  const ahsCombined = ahsOf(combined);
  const ahsNeuronal = ahsOf(neuronal);
  return {
    ok: true,
    value: {
      perDimensionScores,
      droppedDimensions,
      ...(ahsDeterministic !== undefined ? { ahsDeterministic } : {}),
      ...(ahsCombined !== undefined ? { ahsCombined } : {}),
      ...(ahsNeuronal !== undefined ? { ahsNeuronal } : {}),
      verdictSource,
    },
  };
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
