import { Money } from './money';

/** Drop-in passes for non-members; groups of five or more get the team rate. */
export class DayPassOrder {
  static readonly UNIT_PRICE = Money.euros(25);
  static readonly TEAM_SIZE = 5;
  static readonly TEAM_DISCOUNT_PERCENT = 20;

  readonly quantity: number;

  constructor(quantity: number) {
    this.quantity = quantity;
  }

  total(): Money {
    const gross = DayPassOrder.UNIT_PRICE.times(this.quantity);
    return this.quantity >= DayPassOrder.TEAM_SIZE ? gross.discounted(DayPassOrder.TEAM_DISCOUNT_PERCENT) : gross;
  }
}
