import type { Money } from '../model/Money';
import type { Order } from '../model/Order';

const CARD_SURCHARGE_PERCENT = 1.5;

/** What a card payment costs the customer: the order total plus our card surcharge. */
export class CardPricing {
  amountFor(order: Order): Money {
    return order.total.plus(order.total.percent(CARD_SURCHARGE_PERCENT));
  }
}
