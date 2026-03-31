import type { NeuronalInstruction } from '../shared/types/evaluation.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { PipelineError } from '../shared/errors/domain-result.js';

export type VCRMode = 'record' | 'replay' | 'bypass';

export interface NeuronalEvalInput {
  readonly instructions: readonly NeuronalInstruction[];
  readonly graphRepository: GraphRepository;
  readonly provider: LLMProvider;
  readonly runsPerEvaluation?: number;
  readonly vcrMode?: VCRMode;
  readonly cassettePath?: string;
  readonly maxConcurrency?: number;
  readonly unstableThreshold?: number;
}

export const DEFAULT_NEURONAL_OPTIONS = {
  runsPerEvaluation: 3,
  vcrMode: 'bypass' as VCRMode,
  cassettePath: 'fixtures/cassettes',
  maxConcurrency: 3,
  unstableThreshold: 0.15,
};

export interface CriticVerdict {
  readonly pass: boolean;
  readonly confidence: number;
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly violations: readonly CriticViolation[];
}

export interface CriticViolation {
  readonly filePath: string;
  readonly message: string;
}

export interface CassetteEntry {
  readonly functionId: string;
  readonly runIndex: number;
  readonly prompt: string;
  readonly response: string;
  readonly parsedVerdict: CriticVerdict | null;
  readonly timestamp: string;
}

export interface ContextPacket {
  readonly rule: string;
  readonly rubric: { readonly pass: string; readonly fail: string; readonly evidenceRequired: string };
  readonly codeSnippet: string;
  readonly apgSubgraph?: string;
  readonly adrProse?: string;
}

export interface TokenBudget {
  readonly ruleRubric: number;
  readonly codeSnippet: number;
  readonly apgSubgraph: number;
  readonly adrProse: number;
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  ruleRubric: 300,
  codeSnippet: 2000,
  apgSubgraph: 500,
  adrProse: 500,
};

export type CriticErrorCode =
  | 'LLM_CALL_FAILED'
  | 'VERDICT_PARSE_FAILED'
  | 'INSUFFICIENT_VALID_RUNS'
  | 'CONTEXT_ASSEMBLY_FAILED';

export interface CriticError extends PipelineError {
  readonly code: CriticErrorCode;
  readonly stage: 'llm-critic';
  readonly critical: true;
}
