import type { CardCharge } from '../../../domain/model/CardCharge';
import type { Money } from '../../../domain/model/Money';
import type { Order } from '../../../domain/model/Order';

/** Charges a customer's card for an order, in the application's own terms. */
export interface CardPayments {
  charge(order: Order, amount: Money, cardToken: string): Promise<CardCharge>;
}
