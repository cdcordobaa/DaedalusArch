import type { Money } from '../../../domain/model/Money';

export interface CardChargeResult {
  readonly reference: string;
}

/** Charges a card for an amount, in the application's own terms. Rejects with a PaymentError when the card is declined. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
