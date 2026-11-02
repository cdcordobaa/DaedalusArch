import type { Money } from '../../../domain/model/Money';

export interface CardChargeResult {
  readonly chargeId: string;
  readonly amount: Money;
}

/** Thrown when the card processor cannot be reached or is down. */
export class CardPaymentsUnavailableError extends Error {}

/** Charges a card, in the application's own terms. Throws PaymentError when the charge fails. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
