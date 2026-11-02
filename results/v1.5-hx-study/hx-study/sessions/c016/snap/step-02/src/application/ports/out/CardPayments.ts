import type { Money } from '../../../domain/model/Money';
import type { Payment } from '../../../domain/model/Payment';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError when the card is refused. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<Payment>;
}
