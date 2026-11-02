import type { Money } from '../../../domain/model/Money';

export type ChargeResult =
  | { readonly approved: true; readonly reference: string; readonly amount: Money }
  | { readonly approved: false; readonly reason: string }
  /** The payment provider could not be reached. */
  | { readonly approved: false; readonly unavailable: true; readonly reason: string };

/** Charges a card for an amount, in the application's own terms. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeResult>;
}
