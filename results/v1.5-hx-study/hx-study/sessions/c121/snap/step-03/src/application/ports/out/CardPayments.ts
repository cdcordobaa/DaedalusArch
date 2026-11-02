import type { Money } from '../../../domain/model/Money';

/** The result of a successful card charge. */
export interface CardCharge {
  readonly reference: string;
}

/** Charges a card, in the application's own terms. Throws CardDeclinedError when the card is declined. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardCharge>;
}
