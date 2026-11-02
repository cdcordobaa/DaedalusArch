import type { Money } from '../model/Money';

/** Card payments cost the order total plus 1.5%, rounded to the nearest cent. */
export class CardSurcharge {
  static readonly BASIS_POINTS = 150;

  totalToCharge(orderTotal: Money): Money {
    return orderTotal.plus(orderTotal.basisPoints(CardSurcharge.BASIS_POINTS));
  }
}
