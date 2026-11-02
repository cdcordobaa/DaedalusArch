import type { Money } from '../../../domain/model/Money';
import type { Payment } from '../../../domain/model/Payment';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError when the card is not charged. */
export interface CardPayments {
  charge(orderId: string, amount: Money, cardToken: string): Promise<Payment>;
}
