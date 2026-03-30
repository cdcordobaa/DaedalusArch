import type { ADRFormat } from '../shared/types/enums.js';
import type { ADRRule } from '../shared/types/spec.js';
import type { DomainResult } from '../shared/errors/domain-result.js';
import type { PipelineError } from '../shared/errors/domain-result.js';

// ── Public Input/Output Types ─────────────────────────────────────────────────

export interface SpecInput {
  readonly specFilePath: string;
  readonly adrDirPath?: string;
}

export interface SpecParserOptions {
  readonly strictMode?: boolean;
  readonly validateADRRefs?: boolean;
  readonly maxADRFiles?: number;
}

export const DEFAULT_SPEC_PARSER_OPTIONS: Required<SpecParserOptions> = {
  strictMode: false,
  validateADRRefs: true,
  maxADRFiles: 100,
};

// ── Error Types ───────────────────────────────────────────────────────────────

export type SpecParserErrorCode =
  | 'SPEC_NOT_FOUND'
  | 'YAML_SYNTAX_ERROR'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'UNKNOWN_STYLE'
  | 'ZERO_FITNESS_FUNCTIONS'
  | 'BUSINESS_RULE_VIOLATION';

export interface SpecParserError extends PipelineError {
  readonly code: SpecParserErrorCode;
  readonly stage: 'spec-parser';
  readonly critical: true;
}

// ── Validation Types ──────────────────────────────────────────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly rule: string;
}

export interface ValidationWarning {
  readonly code: SpecWarningCode;
  readonly message: string;
  readonly path?: string;
  readonly line?: number;
}

export type SpecWarningCode =
  | 'SPEC_001'
  | 'SPEC_002'
  | 'SPEC_003'
  | 'ADR_001'
  | 'ADR_002'
  | 'ADR_003';

// ── ADR Parser Strategy ──────────────────────────────────────────────────────

export interface ADRParserStrategy {
  readonly format: ADRFormat;
  canParse(content: string, filePath: string): boolean;
  parse(content: string, filePath: string): DomainResult<ADRRule>;
}

// ── Template Types ────────────────────────────────────────────────────────────

export interface BuiltInTemplate {
  readonly style: string;
  readonly version: string;
  readonly functions: readonly import('../shared/types/spec.js').FitnessFunction[];
  readonly defaultWeights: import('../shared/types/spec.js').ScoringWeights;
  readonly defaultFullModeWeights: import('../shared/types/spec.js').ScoringWeights;
  readonly defaultVerdictThresholds: import('../shared/types/spec.js').VerdictThresholds;
  readonly defaultConfidenceThresholds: import('../shared/types/spec.js').ConfidenceThresholds;
}

// ── Internal Types ────────────────────────────────────────────────────────────

export interface RawSpecYAML {
  readonly spec_version?: unknown;
  readonly architecture?: unknown;
  readonly fitness_functions?: unknown;
  readonly scoring?: unknown;
  readonly confidence_thresholds?: unknown;
  readonly [key: string]: unknown;
}
