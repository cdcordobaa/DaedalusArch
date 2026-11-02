import type { Money } from '../../../domain/model/Money';

/** Charges a card; resolves with the provider's charge id, rejects with PaymentError if not paid. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<string>;
}
