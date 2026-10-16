import { DomainError } from '../../domain/errors/DomainError';
import { HttpResponse, fail } from './HttpTypes';

const STATUS_BY_CODE: Record<string, number> = {
  BOOK_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  LOAN_NOT_FOUND: 404,
  INVALID_ISBN: 400,
  INVALID_BOOK: 400,
};

export function toErrorResponse(error: unknown): HttpResponse {
  if (error instanceof DomainError) return fail(STATUS_BY_CODE[error.code] ?? 409, error.message);
  return fail(500, 'Internal error');
}
