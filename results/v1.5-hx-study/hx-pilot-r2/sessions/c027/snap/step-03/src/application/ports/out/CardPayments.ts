import type { Money } from '../../../domain/model/Money';

/** Charges a card, in the application's own terms. Throws PaymentError if the charge fails. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<{ chargeId: string }>;
}
