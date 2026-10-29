import { BookingError } from '../errors/BookingError';

/** Our nightly price for a pitch, and how long a stay may be. */
export class StayPricing {
  static readonly NIGHTLY = 25;

  total(nights: number): number {
    if (!Number.isInteger(nights) || nights < 1 || nights > 21) throw new BookingError('a stay is from 1 to 21 nights');
    return nights * StayPricing.NIGHTLY;
  }
}
