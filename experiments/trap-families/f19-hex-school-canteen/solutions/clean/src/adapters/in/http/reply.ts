import { CanteenError } from '../../../domain/errors/CanteenError';

export interface Reply {
  status: number;
  body: unknown;
}

/** Runs a call and answers 200 with its result, or 400 { error } when the canteen refuses it. */
export function reply(call: () => unknown): Reply {
  try {
    return { status: 200, body: call() };
  } catch (e) {
    if (e instanceof CanteenError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
