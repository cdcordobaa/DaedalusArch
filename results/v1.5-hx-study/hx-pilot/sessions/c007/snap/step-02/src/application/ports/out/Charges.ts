import type { Money } from '../../../domain/model/Money';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError if the charge fails. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<{ reference: string }>;
}
