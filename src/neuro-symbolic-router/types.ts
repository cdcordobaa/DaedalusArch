import type { CompiledFunctions } from '../shared/types/evaluation.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';

export interface RouterInput {
  readonly compiledFunctions: CompiledFunctions;
  readonly mode: EvaluationMode;
  readonly graphRepository: GraphRepository;
  readonly llmProvider: LLMProvider;
}

export type RouterErrorCode =
  | 'NO_FUNCTIONS_TO_EVALUATE'
  | 'SYMBOLIC_ENGINE_FAILED'
  | 'LLM_CRITIC_FAILED'
  | 'ROUTER_FAILED';

export interface RouterError extends PipelineError {
  readonly code: RouterErrorCode;
  readonly stage: 'router';
  readonly critical: true;
}
