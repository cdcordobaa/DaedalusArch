import type { Money } from '../../../domain/model/Money';

export type ChargeResult =
  | { readonly succeeded: true; readonly chargeId: string; readonly amount: Money }
  | { readonly succeeded: false; readonly reason: string };

/** Charges a customer's card, in the application's own terms. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeResult>;
}
