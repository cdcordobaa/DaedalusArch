import { Money } from '../model/Money';

/** Our card surcharge: 1.5% of the total, rounded to the nearest cent. */
export function totalWithCardSurcharge(total: Money): Money {
  const surchargeCents = Math.round((total.cents * 15) / 1000);
  return total.plus(Money.ofCents(surchargeCents, total.currency));
}
