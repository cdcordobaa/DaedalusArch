import type { Money } from '../../../domain/model/Money';

/** A card charge the payment provider has accepted. */
export interface CardCharge {
  readonly reference: string;
  readonly amount: Money;
}

/** Charges a card. Rejects with a PaymentError when the charge is declined or cannot be made. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge>;
}
