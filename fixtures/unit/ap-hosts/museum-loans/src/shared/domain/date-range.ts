import { DomainError } from './domain-error';

const DAY_MS = 24 * 60 * 60 * 1000;

export class InvalidDateRangeError extends DomainError {
  constructor(start: Date, end: Date) {
    super('INVALID_DATE_RANGE', `End ${end.toISOString()} must be after start ${start.toISOString()}`);
  }
}

/** A closed interval of calendar days, used for exhibition runs and loan periods. */
export class DateRange {
  readonly start: Date;
  readonly end: Date;

  constructor(start: Date, end: Date) {
    if (end.getTime() <= start.getTime()) {
      throw new InvalidDateRangeError(start, end);
    }
    this.start = start;
    this.end = end;
  }

  static parse(start: string, end: string): DateRange {
    return new DateRange(new Date(start), new Date(end));
  }

  days(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / DAY_MS);
  }

  overlaps(other: DateRange): boolean {
    return this.start.getTime() <= other.end.getTime() && other.start.getTime() <= this.end.getTime();
  }

  covers(other: DateRange): boolean {
    return this.start.getTime() <= other.start.getTime() && other.end.getTime() <= this.end.getTime();
  }
}
