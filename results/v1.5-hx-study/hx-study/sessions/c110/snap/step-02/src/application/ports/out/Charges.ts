import type { Money } from '../../../domain/model/Money';

export interface ChargeReceipt {
  readonly chargeId: string;
  readonly approved: boolean;
  readonly declineReason?: string;
  readonly amount: Money;
}

/** Charges a card, in the application's own terms. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt>;
}
