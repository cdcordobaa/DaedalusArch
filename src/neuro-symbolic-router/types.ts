import type { CompiledFunctions, EvaluationResults } from '../shared/types/evaluation.js';
import type { EvaluationMode } from '../shared/types/enums.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { APGResult } from '../shared/types/apg.js';
import type { NeuronalEvalInput, NeuronalRunOptions, RunCompleteness, RunManifest } from '../llm-critic/types.js';
import type { NeuronalEvalOutput } from '../llm-critic/llm-critic.js';

export interface RouterInput {
  readonly compiledFunctions: CompiledFunctions;
  readonly mode: EvaluationMode;
  readonly graphRepository: GraphRepository;
  /** Absent in symbolic-only runs; never dereferenced unless a neural half runs (BR-U4-RTR-01). */
  readonly llmProvider?: LLMProvider;
  /** The evaluated project, passed to the critic (BR-U4-RTR-03). */
  readonly projectRoot?: string;
  /** Critic run options (`NeuronalRunOptions`, BR-U4-RTR-03). */
  readonly neuronalOptions?: Partial<NeuronalRunOptions>;
  /** Per-function `exclude_paths` and ADR prose for the critic (SEL-01, CTX-06). */
  readonly excludePaths?: NeuronalEvalInput['excludePaths'];
  readonly adrProse?: NeuronalEvalInput['adrProse'];
  /** Known secrets scrubbed from failure messages (symbolic BR-U3-58, critic CAS-07). */
  readonly knownSecrets?: readonly string[];
  /** APG for the symbolic SCC strategy (BR-U3-45), as the symbolic command passes it. */
  readonly apg?: Pick<APGResult, 'nodes' | 'edges'>;
}

/**
 * Router output: the C10 `EvaluationResults` (both failure lists forwarded, BR-U4-AGG-06) plus the
 * critic's completeness and manifest, and its output for `toNeuralResultRows` (BR-U3-65). An
 * incomplete neural run makes the command write the manifest, no report, and exit 3 (AGG-03).
 */
export interface RoutedEvaluation extends EvaluationResults {
  readonly failures: NonNullable<EvaluationResults['failures']>;
  readonly neuralCompleteness: RunCompleteness;
  readonly neuralManifest?: RunManifest;
  /** The critic's output when a neural half ran (absent otherwise). */
  readonly neuralOutput?: NeuronalEvalOutput;
}

export type RouterErrorCode =
  | 'NO_FUNCTIONS_TO_EVALUATE'
  | 'SYMBOLIC_ENGINE_FAILED'
  | 'LLM_CRITIC_FAILED'
  | 'LLM_NOT_CONFIGURED'
  | 'ROUTER_FAILED';

export interface RouterError extends PipelineError {
  readonly code: RouterErrorCode;
  readonly stage: 'router';
  readonly critical: true;
}
