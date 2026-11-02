import type { Locker } from './Locker';
import { sizeRank, type LockerSize } from './LockerSize';

/** The locker a new load goes into: the smallest one that takes it, then the lowest bay. */
export function chooseLocker(lockers: readonly Locker[], load: LockerSize): Locker | undefined {
  return lockers
    .filter((l) => l.accepts(load))
    .sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.bay - b.bay)[0];
}
