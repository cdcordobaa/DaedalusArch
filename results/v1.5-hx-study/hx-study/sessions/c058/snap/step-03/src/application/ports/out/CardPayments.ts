import type { Money } from '../../../domain/model/Money';

export interface CardChargeReceipt {
  /** The provider's id for the charge; refunds name it. */
  readonly reference: string;
  readonly amount: Money;
}

/** Charges a card, in the application's own terms. Throws PaymentError when the card is refused. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeReceipt>;
}
