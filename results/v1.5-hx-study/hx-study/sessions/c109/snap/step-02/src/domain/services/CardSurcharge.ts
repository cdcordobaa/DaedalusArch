import { Money } from '../model/Money';

/** Our card surcharge: 1.5% of the order total, rounded to the nearest cent. */
export class CardSurcharge {
  static readonly RATE_PER_THOUSAND = 15;

  /** The total plus the surcharge, in the total's currency. */
  totalWithSurcharge(total: Money): Money {
    // Integer arithmetic: cents * 15 / 1000, half a cent rounds up.
    const surchargeCents = Math.round((total.cents * CardSurcharge.RATE_PER_THOUSAND) / 1000);
    return total.plus(Money.ofCents(surchargeCents, total.currency));
  }
}
