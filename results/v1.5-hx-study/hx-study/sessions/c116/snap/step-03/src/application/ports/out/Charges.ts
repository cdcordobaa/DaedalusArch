import type { Money } from '../../../domain/model/Money';

export type DeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

export type ChargeResult =
  | { readonly succeeded: true; readonly reference: string; readonly amount: Money }
  | { readonly succeeded: false; readonly reason: DeclineReason };

/** Thrown by a Charges implementation when the payment provider cannot be reached. */
export class ChargesUnavailableError extends Error {}

/** Charges a card for an amount, in the application's own terms. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeResult>;
}
