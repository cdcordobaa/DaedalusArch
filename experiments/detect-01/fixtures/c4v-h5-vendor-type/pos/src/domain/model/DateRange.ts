/** Value object: a stay from check-in (inclusive) to check-out (exclusive). */
export class DateRange {
  constructor(readonly checkIn: Date, readonly checkOut: Date) {
    if (checkOut.getTime() <= checkIn.getTime()) throw new Error('Check-out must be after check-in');
  }

  overlaps(other: DateRange): boolean {
    return this.checkIn < other.checkOut && other.checkIn < this.checkOut;
  }

  nights(): number {
    return Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / 86_400_000);
  }
}
