import type { Money } from '../../../domain/model/Money';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError when the payment cannot be taken. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<{ readonly reference: string }>;
}
