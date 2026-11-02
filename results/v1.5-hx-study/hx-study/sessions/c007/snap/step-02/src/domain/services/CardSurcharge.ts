import { Money } from '../model/Money';

/** Card surcharge: 1.5% of the total, rounded to the nearest cent (integer arithmetic, no float drift). */
export function totalWithCardSurcharge(total: Money): Money {
  const surchargeCents = Math.floor((total.cents * 15 + 500) / 1000);
  return total.plus(Money.ofCents(surchargeCents, total.currency));
}
