import type { TimeSlot } from './value-objects/TimeSlot';

/** One member's booking of a car for a time slot. */
export interface Booking {
  readonly id: string;
  readonly memberId: string;
  readonly slot: TimeSlot;
}
