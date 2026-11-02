import type { Money } from '../../../domain/model/Money';

/** A card charge the provider has accepted. */
export interface CardCharge {
  readonly reference: string;
  readonly amount: Money;
}

/** Charges a card; rejects with a PaymentError when the card is declined or the provider is unavailable. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge>;
}
