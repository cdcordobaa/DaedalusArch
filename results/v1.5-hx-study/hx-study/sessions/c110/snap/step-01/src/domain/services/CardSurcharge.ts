import { Money } from '../model/Money';

/** Card surcharge of 1.5% of the total, rounded to the nearest cent. */
export class CardSurcharge {
  applyTo(total: Money): Money {
    const fee = Math.round((total.cents * 15) / 1000);
    return total.plus(Money.ofCents(fee, total.currency));
  }
}
