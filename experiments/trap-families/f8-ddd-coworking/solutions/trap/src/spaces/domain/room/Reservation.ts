import type { TimeSlot } from './value-objects/TimeSlot';

/** One team's reservation of a meeting room for a time slot, for a number of people. */
export interface Reservation {
  readonly id: string;
  readonly teamId: string;
  readonly people: number;
  readonly slot: TimeSlot;
}
