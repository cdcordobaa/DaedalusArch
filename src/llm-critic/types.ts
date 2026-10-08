import type { InvalidCause, NeuronalInstruction } from '../shared/types/evaluation.js';
import type { LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import type { JudgeUnitKind } from '../shared/types/enums.js';
import { JUDGE_TOKEN_BUDGET } from './frozen.js';

// C10 cassette mode re-exported (D-U0-3, U4-K2): the C7-only bypass member is gone; default 'record' (BR-U4-CAS-05)
export type { VCRMode };

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
  vcrMode: 'record' as VCRMode,
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

// Call outcomes (U4 DE §4.2; BR-U4-CAS-04, AGG-02). `InvalidCause` is the C10 type.
export type CallOutcome =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly cause: InvalidCause };

// Stop causes are never recorded in a cassette; they make the run incomplete (BR-U4-AGG-03).
export type StopCause = 'USAGE_LIMIT' | 'AUTH' | 'CLI_NOT_FOUND' | 'CASSETTE_MISS' | 'ISOLATION' | 'CLI_VERSION';

export interface CassetteEntry {
  readonly functionId: string;
  readonly runIndex: number;
  readonly prompt: string;
  readonly response: string;
  readonly parsedVerdict: CriticVerdict | null;
  readonly timestamp: string;
}

// Context packet of one unit (U4 DE §3.3; BR-U4-CTX-06): the frozen prompt template's inputs.
export interface ContextPacket {
  readonly rule: string;
  readonly rubric: { readonly pass: string; readonly fail: string; readonly evidenceRequired: string };
  readonly layerModel: string;            // from the evaluation spec only (BR-U4-CTX-07)
  readonly unitId: string;
  readonly unitKind: JudgeUnitKind;
  readonly unitLayer: string;
  readonly unitFiles: readonly string[];
  readonly source: string;                // fenced file blocks (BR-U4-CTX-05)
  readonly signatures?: string;           // module units
  readonly incoming: readonly string[];   // module units
  readonly outgoing: readonly string[];   // module units
  readonly apgSubgraph: string;           // canonical JSON excerpt, '{"edges":[],"nodes":[]}' when empty
  readonly adrProse?: string;
}

// Token budgets (U4 DE §3.4, BR-U4-CTX-03); 1 token = CHARS_PER_TOKEN characters.
export interface TokenBudget {
  readonly ruleRubric: number;   // 300 (frozen rubric text must fit)
  readonly codeSnippet: number;  // file/class units: 8000
  readonly moduleSource: number; // module units: 24000
  readonly apgSubgraph: number;  // 1000
  readonly adrProse: number;     // 1000
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = JUDGE_TOKEN_BUDGET;

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
