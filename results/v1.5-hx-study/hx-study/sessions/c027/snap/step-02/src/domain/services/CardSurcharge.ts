import { Money } from '../model/Money';

/** Card surcharge: 1.5% of the total, rounded to the nearest cent. */
export function withCardSurcharge(total: Money): Money {
  const surchargeCents = Math.round((total.cents * 15) / 1000);
  return total.plus(Money.ofCents(surchargeCents, total.currency));
}
