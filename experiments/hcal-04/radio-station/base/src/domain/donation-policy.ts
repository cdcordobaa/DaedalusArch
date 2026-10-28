import { DonationTooSmallError } from './errors';

export class DonationPolicy {
  static readonly MINIMUM_CENTS = 100;

  assertAcceptable(amountCents: number): void {
    if (amountCents < DonationPolicy.MINIMUM_CENTS) {
      throw new DonationTooSmallError(`Minimum donation is ${DonationPolicy.MINIMUM_CENTS} cents`);
    }
  }
}
