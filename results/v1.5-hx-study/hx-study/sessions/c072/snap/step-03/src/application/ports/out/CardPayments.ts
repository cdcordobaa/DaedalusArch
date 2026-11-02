import type { Money } from '../../../domain/model/Money';

export type CardDeclineReason = 'not-enough-funds' | 'expired' | 'other';

export type CardChargeResult =
  | { readonly outcome: 'charged'; readonly paymentReference: string }
  | { readonly outcome: 'declined'; readonly reason: CardDeclineReason }
  | { readonly outcome: 'unavailable' };

/** Takes a card payment, in the application's own terms. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
