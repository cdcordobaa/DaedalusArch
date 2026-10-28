import { SchoolError } from '../../../domain/SchoolError';

export interface Answer {
  readonly status: number;
  readonly body: unknown;
}

/** Runs a call: 200 with its result, or 400 { error } when the school refuses it. */
export function answer(call: () => unknown): Answer {
  try {
    return { status: 200, body: call() };
  } catch (e) {
    if (e instanceof SchoolError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
