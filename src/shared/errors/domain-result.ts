export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface DomainWarning {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export type DomainResult<T> =
  | { readonly success: true; readonly data: T; readonly warnings?: readonly DomainWarning[] }
  | { readonly success: false; readonly errors: readonly DomainError[]; readonly warnings?: readonly DomainWarning[] };

export const DomainResult = {
  ok<T>(data: T, warnings?: readonly DomainWarning[]): DomainResult<T> {
    return warnings !== undefined
      ? { success: true, data, warnings }
      : { success: true, data };
  },

  fail<T>(errors: readonly DomainError[], warnings?: readonly DomainWarning[]): DomainResult<T> {
    if (errors.length === 0) {
      throw new Error('DomainResult.fail requires at least one error');
    }
    return warnings !== undefined
      ? { success: false, errors, warnings }
      : { success: false, errors };
  },

  fromError<T>(error: unknown): DomainResult<T> {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNEXPECTED_ERROR';
    return DomainResult.fail([{ code, message }]);
  },
} as const;

export interface PipelineError extends DomainError {
  readonly stage: string;
  readonly critical: boolean;
}

export interface PipelineWarning extends DomainWarning {
  readonly stage: string;
}

export interface PipelineAuditEntry {
  readonly timestamp: string;
  readonly stage: string;
  readonly event: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
