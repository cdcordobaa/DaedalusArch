import { BusinessError } from '../../business/errors/BusinessError';
import { HttpResponse } from './HttpTypes';

const STATUS = { NOT_FOUND: 404, INVALID: 400, CONFLICT: 409 } as const;

export function errorResponse(error: unknown): HttpResponse {
  if (error instanceof BusinessError) return { status: STATUS[error.code], body: { error: error.message } };
  return { status: 500, body: { error: 'Internal error' } };
}
