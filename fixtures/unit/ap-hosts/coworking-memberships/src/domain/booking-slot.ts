import { DomainError } from './domain-error';

/** Rooms are booked in half-hour steps, for at most a working day. */
export const SLOT_MINUTES = 30;
export const MAX_BOOKING_MINUTES = 8 * 60;

export class BookingTooLongError extends DomainError {
  constructor(minutes: number) {
    super('BOOKING_TOO_LONG', `A room booking lasts at most ${String(MAX_BOOKING_MINUTES)} minutes; requested ${String(minutes)}`);
  }
}

export class SlotTakenError extends DomainError {
  constructor(resource: string) {
    super('SLOT_TAKEN', `${resource} is already booked at that time`);
  }
}

/** A half-open interval [start, start + minutes) on one room. */
export class BookingSlot {
  readonly start: Date;
  readonly minutes: number;

  constructor(start: Date, minutes: number) {
    this.start = start;
    this.minutes = minutes;
  }

  get end(): Date {
    return new Date(this.start.getTime() + this.minutes * 60_000);
  }

  halfHours(): number {
    return Math.ceil(this.minutes / SLOT_MINUTES);
  }

  overlaps(other: BookingSlot): boolean {
    return this.start < other.end && other.start < this.end;
  }
}
