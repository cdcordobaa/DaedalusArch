import type { CypherQuery } from '../shared/types/evaluation.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { PipelineError, PipelineWarning } from '../shared/errors/domain-result.js';
import type { FunctionId } from '../shared/types/value-objects.js';
import type { APGResult } from '../shared/types/apg.js';

export interface SymbolicEvalInput {
  readonly queries: readonly CypherQuery[];
  readonly graphRepository: GraphRepository;
  /** Per-query timeout passed through when set; otherwise the repository default applies (BR-U3-03). */
  readonly queryTimeoutMs?: number;
  /** Known secrets scrubbed from every failure message and warning (BR-U3-58); shapes are always scrubbed. */
  readonly knownSecrets?: readonly string[];
  /** `context.getApgResult()`; read only when `CYCLE_STRATEGY === 'scc'` (FF-S02 from the APG, BR-U3-45). */
  readonly apg?: Pick<APGResult, 'nodes' | 'edges'>;
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
