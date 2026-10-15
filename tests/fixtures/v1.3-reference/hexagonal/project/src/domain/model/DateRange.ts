import { BookingError } from '../errors/BookingError';

const DAY_MS = 24 * 60 * 60 * 1000;

export class DateRange {
  constructor(
    readonly checkIn: Date,
    readonly checkOut: Date,
  ) {
    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new BookingError('invalid', 'Check-out must be after check-in');
    }
  }

  static parse(checkIn: string, checkOut: string): DateRange {
    return new DateRange(new Date(checkIn), new Date(checkOut));
  }

  nights(): number {
    return Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / DAY_MS);
  }

  overlaps(other: DateRange): boolean {
    return this.checkIn.getTime() < other.checkOut.getTime() && other.checkIn.getTime() < this.checkOut.getTime();
  }
}
