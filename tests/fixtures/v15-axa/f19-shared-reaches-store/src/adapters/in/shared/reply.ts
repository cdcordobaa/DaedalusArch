import { CanteenError } from '../../../domain/errors/CanteenError';
import { CanteenDatabase } from '../../out/memory/CanteenDatabase';

export interface Reply {
  status: number;
  body: unknown;
}

/** One shared database for every route (reaches into an outbound adapter: not a helper any more). */
export const sharedDb = new CanteenDatabase();

/** Runs a call and answers 200 with its result, or 400 { error } when the canteen refuses it. */
export function reply(call: () => unknown): Reply {
  try {
    return { status: 200, body: call() };
  } catch (e) {
    if (e instanceof CanteenError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}
