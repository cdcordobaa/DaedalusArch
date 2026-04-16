import type { FitnessFunction, ADRRule, LayerModel, ScoringWeights } from '../shared/types/spec.js';
import type { DomainWarning, PipelineError } from '../shared/errors/domain-result.js';

export interface CompilerInput {
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly adrRules: readonly ADRRule[];
  readonly layerModel: LayerModel;
  readonly scoringWeights: ScoringWeights;
}

export type CompilerErrorCode =
  | 'MISSING_REQUIRED_PARAM'
  | 'DUPLICATE_FUNCTION_ID'
  | 'COMPILATION_FAILED';

export interface CompilerError extends PipelineError {
  readonly code: CompilerErrorCode;
  readonly stage: 'fitness-compiler';
  readonly critical: true;
}

export type CompilerWarningCode =
  | 'COMPILER_001'   // neuronal-only, no Cypher template (expected)
  | 'COMPILER_002'   // unknown function name, no built-in template
  | 'COMPILER_003'   // shadow mode eligible but no handcrafted Cypher
  | 'COMPILER_004';  // fitness function auto-disabled (e.g. too few layers)

export interface CompilerWarning extends DomainWarning {
  readonly code: CompilerWarningCode;
  readonly functionId?: string;
}

export interface ResultMapping {
  readonly filePathColumn: string;
  readonly messageTemplate: string;
  readonly metadataColumns?: readonly string[];
}

export interface CypherTemplate {
  readonly functionName: string;
  readonly template: string;
  readonly requiredParams: readonly string[];
  readonly optionalParams: readonly string[];
  readonly description: string;
  readonly resultMapping: ResultMapping;
}
