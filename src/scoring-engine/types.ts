import type { EvaluationResults } from '../shared/types/evaluation.js';
import type { ScoringWeights, ConfidenceThresholds, VerdictThresholds } from '../shared/types/spec.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';

export interface ScoringInput {
  readonly evaluationResults: EvaluationResults;
  readonly scoringWeights: ScoringWeights;
  readonly fullModeWeights?: ScoringWeights;
  readonly confidenceThresholds: ConfidenceThresholds;
  readonly verdictThresholds: VerdictThresholds;
  readonly mode: EvaluationMode;
  readonly projectPath: string;
  readonly specVersion: string;
  readonly graphRepository: GraphRepository;
}

export type ScoringErrorCode =
  | 'SCORING_FAILED'
  | 'METRICS_QUERY_FAILED';

export interface ScoringError extends PipelineError {
  readonly code: ScoringErrorCode;
  readonly stage: 'scoring-engine';
  readonly critical: true;
}
