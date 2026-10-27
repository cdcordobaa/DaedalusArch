import { SpaceError } from '../../SpaceError';

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * A reserved period within one day, from `start` (included) to `end` (excluded), written YYYY-MM-DDTHH:MM. Immutable.
 */
export class TimeSlot {
  private constructor(
    readonly start: string,
    readonly end: string,
    readonly startMinute: number,
    readonly endMinute: number,
  ) {}

  static of(start: string, end: string): TimeSlot {
    if (!STAMP.test(start) || !STAMP.test(end)) throw new SpaceError('times are written YYYY-MM-DDTHH:MM');
    const from = Date.parse(`${start}:00Z`) / 60000;
    const to = Date.parse(`${end}:00Z`) / 60000;
    if (Number.isNaN(from) || Number.isNaN(to)) throw new SpaceError(`not a time: ${start} to ${end}`);
    if (to <= from) throw new SpaceError('a reservation must end after it starts');
    if (start.slice(0, 10) !== end.slice(0, 10)) throw new SpaceError('a reservation starts and ends on the same day');
    return new TimeSlot(start, end, from, to);
  }

  /** The day of the slot, YYYY-MM-DD. */
  get day(): string {
    return this.start.slice(0, 10);
  }

  get minutes(): number {
    return this.endMinute - this.startMinute;
  }

  overlaps(other: TimeSlot): boolean {
    return this.startMinute < other.endMinute && other.startMinute < this.endMinute;
  }

  equals(other: TimeSlot): boolean {
    return other.startMinute === this.startMinute && other.endMinute === this.endMinute;
  }
}
