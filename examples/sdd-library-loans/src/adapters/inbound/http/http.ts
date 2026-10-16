import { DomainError } from '../../../domain/catalog/errors';

/** The minimal HTTP shape the inbound adapters speak; a real server would map its own request to this. */
export interface HttpRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  NOT_FOUND: 404,
  DUPLICATE_BOOK: 409,
  DUPLICATE_MEMBER: 409,
  NO_COPY_AVAILABLE: 409,
  BORROWING_LIMIT: 409,
  ALREADY_RETURNED: 409,
};

/** Domain errors become 4xx answers; anything else is a 500 without internals. */
export function errorResponse(err: unknown): HttpResponse {
  if (err instanceof DomainError) {
    return { status: STATUS_BY_CODE[err.code] ?? 400, body: { error: err.code, message: err.message } };
  }
  return { status: 500, body: { error: 'INTERNAL', message: 'unexpected error' } };
}

export function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;
}
