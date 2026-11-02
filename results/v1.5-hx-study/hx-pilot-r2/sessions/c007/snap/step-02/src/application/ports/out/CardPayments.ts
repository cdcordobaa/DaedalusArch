import type { Money } from '../../../domain/model/Money';

/** Charges a customer's card. Throws PaymentError if the charge does not go through. */
export interface CardPayments {
  charge(orderId: string, cardToken: string, amount: Money): Promise<{ amount: Money; reference: string }>;
}
