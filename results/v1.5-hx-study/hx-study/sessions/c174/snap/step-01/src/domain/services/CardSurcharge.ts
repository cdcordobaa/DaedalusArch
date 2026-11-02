import { Money } from '../model/Money';

/** Our card surcharge: 1.5% of the total, rounded to the nearest cent (halves up). */
export class CardSurcharge {
  totalWithSurcharge(total: Money): Money {
    const surchargeCents = Math.floor((total.cents * 15 + 500) / 1000);
    return Money.ofCents(total.cents + surchargeCents, total.currency);
  }
}
