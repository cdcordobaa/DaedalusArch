import type { Locker } from '../../../domain/Locker';

/** The door latches of the locker banks. */
export interface LockerDoors {
  /** Opens the locker's door; false when the door did not open. */
  open(locker: Locker): boolean;
}
