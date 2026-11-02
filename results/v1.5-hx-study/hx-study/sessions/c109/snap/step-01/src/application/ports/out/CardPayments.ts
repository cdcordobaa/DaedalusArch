import type { Money } from '../../../domain/model/Money';

export type CardChargeResult =
  | { readonly approved: true; readonly reference: string }
  | { readonly approved: false; readonly reason: string };

/** Takes a card payment, in the application's own terms. */
export interface CardPayments {
  charge(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
