import type { DomainError, DomainWarning, PipelineError, PipelineWarning } from '../../shared/errors/domain-result.js';

export function toPipelineError(
  error: DomainError,
  stage: string,
  critical: boolean,
): PipelineError {
  return {
    code: error.code,
    message: error.message,
    ...(error.context !== undefined && { context: error.context }),
    stage,
    critical,
  };
}

export function toPipelineWarning(
  warning: DomainWarning,
  stage: string,
): PipelineWarning {
  return {
    code: warning.code,
    message: warning.message,
    ...(warning.context !== undefined && { context: warning.context }),
    stage,
  };
}
