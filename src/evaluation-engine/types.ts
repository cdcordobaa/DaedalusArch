import type { CypherQuery } from '../shared/types/evaluation.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { PipelineError, PipelineWarning } from '../shared/errors/domain-result.js';
import type { FunctionId } from '../shared/types/value-objects.js';

export interface SymbolicEvalInput {
  readonly queries: readonly CypherQuery[];
  readonly graphRepository: GraphRepository;
}

export type EvalErrorCode =
  | 'QUERY_EXECUTION_FAILED'
  | 'RESULT_MAPPING_FAILED'
  | 'ENGINE_FAILED';

export interface EvalError extends PipelineError {
  readonly code: EvalErrorCode;
  readonly stage: 'evaluation-engine';
  readonly critical: true;
}

export interface EvalWarning extends PipelineWarning {
  readonly code: string;
  readonly functionId?: FunctionId;
}
