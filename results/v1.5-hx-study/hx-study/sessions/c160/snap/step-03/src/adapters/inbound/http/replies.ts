import { EntryError } from '../../../domain/errors/EntryError';
import { RegistrationBusyError } from '../../../domain/errors/RegistrationBusyError';

export interface HttpResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function json(status: number, body: unknown): HttpResponse {
  return { status, headers: { ...JSON_HEADERS }, body };
}

/** Turns a refused entry into the entry form's answer; anything else is a bug and is thrown on. */
export function refusal(e: unknown): HttpResponse {
  if (!(e instanceof EntryError)) throw e;
  if (e instanceof RegistrationBusyError) {
    const res = json(503, { error: e.message });
    return { ...res, headers: { ...res.headers, 'Retry-After': String(e.retryAfterSeconds) } };
  }
  const own =(e as { statusCode?: unknown }).statusCode;
  return json(typeof own === 'number' ? own : 422, { error: e.message });
}
