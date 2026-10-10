import type { CompiledFunctions, EvaluationResults } from '../shared/types/evaluation.js';
import type { ScoringWeights, ConfidenceThresholds, VerdictThresholds, FitnessFunction } from '../shared/types/spec.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { APGResult } from '../shared/types/apg.js';
import type { CycleMetricTiming } from './universal-metrics.js';
import type { NeuralAggregation } from './neural-aggregation.js';

/** domain-entities.md §4.1 (U3-owned). */
export interface ScoringInput {
  readonly evaluationResults: EvaluationResults;     // includes failures (C10)
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;         // required in full and neuronal-only modes (BR-U3-37)
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly verdictThresholds: VerdictThresholds;
  readonly mode: EvaluationMode;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly graphRepository: GraphRepository;
  readonly fitnessFunctions: readonly FitnessFunction[];   // declared counts by dimension (BR-U3-34)
  readonly compiled: CompiledFunctions;                    // disabled counts by dimension
  readonly noJudgeUnits: readonly FunctionId[];            // `no-judge-units` drop reason (BR-U3-34)
  readonly apg?: APGResult;                                // context.getApgResult(); read only when CYCLE_STRATEGY === 'scc' (BR-U3-45)
  /** Receives the universal cycle metric's own timing (ADR-016 e; ADR-021 SO2; audit SO2-2). */
  readonly onCycleMetricTiming?: (timing: CycleMetricTiming) => void;
  /** ADR-028: neural aggregation of the AHS fields (default `registered`); stamped in judge modes. */
  readonly neuralAggregation?: NeuralAggregation;
}

export type ScoringErrorCode =
  | 'SCORING_FAILED'
  | 'METRICS_QUERY_FAILED'
  | 'SCORING_NO_EXECUTED_WEIGHT'          // BR-U3-37
  | 'CONFIG_MISSING_FULL_MODE_WEIGHTS';   // BR-U3-37

export interface ScoringError extends PipelineError {
  readonly code: ScoringErrorCode;
  readonly stage: 'scoring-engine';
  readonly critical: true;
}
