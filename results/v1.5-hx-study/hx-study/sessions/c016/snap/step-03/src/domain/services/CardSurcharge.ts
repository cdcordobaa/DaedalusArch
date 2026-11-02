import { Money } from '../model/Money';

/** Our card surcharge: 1.5% of the total, rounded to the nearest cent. */
export class CardSurcharge {
  static totalWithSurcharge(total: Money): Money {
    const surcharge = Math.floor((total.cents * 15 + 500) / 1000);
    return total.plus(Money.ofCents(surcharge, total.currency));
  }
}
