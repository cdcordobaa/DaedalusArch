import { ArrayCapacityExceededError } from './errors';

export const TOTAL_SHARES = 1000;

export const MAX_SHARES_PER_MEMBER = 100;

export class ArrayCapacity {
  static ensureMemberLimit(held: number, requested: number): void {
    if (held + requested > MAX_SHARES_PER_MEMBER) {
      throw new ArrayCapacityExceededError(`a member may hold at most ${MAX_SHARES_PER_MEMBER} shares`);
    }
  }
  static ensureAvailable(subscribed: number, requested: number): void {
    if (subscribed + requested > TOTAL_SHARES) {
      throw new ArrayCapacityExceededError(`only ${TOTAL_SHARES - subscribed} shares left`);
    }
  }
}
