import { Money } from '../model/Money';

/** Our card surcharge: 1.5% of the order total, rounded to the nearest cent. */
export class CardSurcharge {
  static chargeableFor(total: Money): Money {
    // 1.5% = 15/1000, computed in integers so halves round up without float error.
    const surchargeCents = Math.floor((total.cents * 15 + 500) / 1000);
    return Money.ofCents(total.cents + surchargeCents, total.currency);
  }
}
