import type { Money } from '../../../domain/model/Money';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError when the card is refused. */
export interface CardPayments {
  charge(orderId: string, amount: Money, cardToken: string): Promise<{ readonly reference: string }>;
}
