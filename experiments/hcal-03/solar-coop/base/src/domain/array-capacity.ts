import { ArrayCapacityExceededError } from './errors';

export const TOTAL_SHARES = 1000;

export class ArrayCapacity {
  static ensureAvailable(subscribed: number, requested: number): void {
    if (subscribed + requested > TOTAL_SHARES) {
      throw new ArrayCapacityExceededError(`only ${TOTAL_SHARES - subscribed} shares left`);
    }
  }
}
