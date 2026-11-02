import { HireError } from '../errors/HireError';

/** Our nightly rate and how long a hire may be. */
export class HirePricing {
  static readonly NIGHTLY = 120;

  price(nights: number, premium: number): number {
    if (!Number.isInteger(nights) || nights < 2 || nights > 14) throw new HireError('a hire is 2 to 14 nights');
    return nights * HirePricing.NIGHTLY + premium;
  }
}
