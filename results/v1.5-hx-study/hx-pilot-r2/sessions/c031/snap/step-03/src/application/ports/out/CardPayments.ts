import type { Money } from '../../../domain/model/Money';

export interface CardCharge {
  /** The provider's charge id, which refunds name later. */
  readonly reference: string;
  readonly amount: Money;
}

/** Charges a card; rejects with a PaymentError when the charge cannot be made. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge>;
}
