import { DomainError } from "./errors.js";

export const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;
/** Slots a doctor can take per day (8 hours of 30-minute slots). */
export const AVAILABLE_SLOTS_PER_DAY = 16;

/** The UTC calendar day of `date` as YYYY-MM-DD: the date format used by reports and invoices. */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A 30-minute slot, aligned to :00 or :30 (UTC). Immutable value object. */
export class TimeSlot {
  private constructor(readonly start: Date) {}

  static startingAt(start: Date): TimeSlot {
    if (Number.isNaN(start.getTime())) {
      throw new DomainError("Slot start is not a valid date");
    }
    if (start.getTime() % SLOT_MS !== 0) {
      throw new DomainError(`Slot start must be aligned to a ${SLOT_MINUTES}-minute boundary`);
    }
    return new TimeSlot(new Date(start.getTime()));
  }

  get day(): string {
    return formatDay(this.start);
  }

  get end(): Date {
    return new Date(this.start.getTime() + SLOT_MS);
  }

  equals(other: TimeSlot): boolean {
    return this.start.getTime() === other.start.getTime();
  }
}
