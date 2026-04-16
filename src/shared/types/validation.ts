export type ValidationErrorCode =
  | 'LAYER_DIR_NOT_FOUND'
  | 'DUPLICATE_FUNCTION_ID'
  | 'INVALID_TEMPLATE_REF'
  | 'INVALID_THRESHOLD'
  | 'INVALID_GLOB_PATTERN'
  | 'UNKNOWN_DIMENSION'
  | 'UNKNOWN_SEVERITY'
  | 'UNKNOWN_ROUTE';

export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly field?: string;
  readonly suggestion?: string;
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export interface ValidationSummary {
  readonly totalFunctions: number;
  readonly enabledFunctions: number;
  readonly disabledFunctions: number;
  readonly totalLayers: number;
  readonly totalErrors: number;
  readonly totalWarnings: number;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly summary: ValidationSummary;
}
