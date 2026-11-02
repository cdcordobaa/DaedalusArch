import type { Money } from '../../../domain/model/Money';

export interface CardChargeResult {
  readonly chargeId: string;
  readonly amount: Money;
}

/** Thrown when the card processor cannot be reached or is down. */
export class CardPaymentsUnavailableError extends Error {}

export type CardDeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** Thrown when the card processor declines the card. */
export class CardDeclinedError extends Error {
  constructor(readonly reason: CardDeclineReason) {
    super(`the card was declined: ${reason}`);
    this.name = 'CardDeclinedError';
  }
}

/** Charges a card, in the application's own terms. Throws PaymentError when the charge fails. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
