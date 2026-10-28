import { AccessRefused, InvalidRequest, LoungeFull, NotFound } from '../../../domain/errors/LoungeErrors';

/** What the desk app receives for every call. */
export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

/** Runs one call and turns its outcome into a reply: 200 with the result, or the error's status with { error }. */
export function reply(call: () => unknown): Reply {
  try {
    return { status: 200, body: call() ?? {} };
  } catch (e) {
    if (e instanceof InvalidRequest) return { status: 400, body: { error: e.message } };
    if (e instanceof NotFound) return { status: 404, body: { error: e.message } };
    if (e instanceof LoungeFull) return { status: 503, body: { error: e.message, retryAfterMinutes: e.retryAfterMinutes } };
    if (e instanceof AccessRefused) return { status: 422, body: { error: e.message } };
    throw e;
  }
}
