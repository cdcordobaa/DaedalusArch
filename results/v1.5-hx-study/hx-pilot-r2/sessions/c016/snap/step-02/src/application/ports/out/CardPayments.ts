import type { Money } from '../../../domain/model/Money';

export type CardChargeResult =
  | { readonly paid: true; readonly reference: string }
  | { readonly paid: false; readonly reason: string }
  | { readonly paid: false; readonly unavailable: true; readonly reason: string };

/** Charges a customer's card, in the application's own terms. */
export interface CardPayments {
  charge(orderId: string, amount: Money, cardToken: string): Promise<CardChargeResult>;
}
