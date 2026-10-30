import { EntryError } from '../../../domain/errors/EntryError';
import { PlayerUnknown } from '../../../domain/errors/PlayerUnknown';
import { RatingsBusy } from '../../../domain/errors/RatingsBusy';

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
  if (e instanceof PlayerUnknown) return json(404, { error: e.message });
  if (e instanceof RatingsBusy) return { ...json(503, { error: e.message }), headers: { ...JSON_HEADERS, 'Retry-After': String(e.retryInSeconds) } };
  const own = (e as { statusCode?: unknown }).statusCode;
  return json(typeof own === 'number' ? own : 422, { error: e.message });
}
