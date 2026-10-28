import { formatTime } from './TimeOfDay';

/** A stretch of one day, from `from` (inclusive) to `to` (exclusive), in minutes since midnight. */
export class TimeWindow {
  constructor(readonly from: number, readonly to: number) {}

  contains(other: TimeWindow): boolean {
    return this.from <= other.from && other.to <= this.to;
  }

  overlaps(other: TimeWindow): boolean {
    return this.from < other.to && other.from < this.to;
  }

  get start(): string {
    return formatTime(this.from);
  }

  get end(): string {
    return formatTime(this.to);
  }

  label(): string {
    return `${this.start}-${this.end}`;
  }
}
