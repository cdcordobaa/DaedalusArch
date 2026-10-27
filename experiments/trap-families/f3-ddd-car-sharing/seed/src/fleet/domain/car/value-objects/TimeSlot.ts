import { FleetError } from '../../FleetError';

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A booked period, from `start` (included) to `end` (excluded), written YYYY-MM-DDTHH:MM. Immutable. */
export class TimeSlot {
  private constructor(
    readonly start: string,
    readonly end: string,
    readonly startMinute: number,
    readonly endMinute: number,
  ) {}

  static of(start: string, end: string): TimeSlot {
    if (!STAMP.test(start) || !STAMP.test(end)) throw new FleetError('times are written YYYY-MM-DDTHH:MM');
    const from = Date.parse(`${start}:00Z`) / 60000;
    const to = Date.parse(`${end}:00Z`) / 60000;
    if (Number.isNaN(from) || Number.isNaN(to)) throw new FleetError(`not a time: ${start} to ${end}`);
    if (to <= from) throw new FleetError('a booking must end after it starts');
    return new TimeSlot(start, end, from, to);
  }

  overlaps(other: TimeSlot): boolean {
    return this.startMinute < other.endMinute && other.startMinute < this.endMinute;
  }

  equals(other: TimeSlot): boolean {
    return other.startMinute === this.startMinute && other.endMinute === this.endMinute;
  }
}
