import type { Money } from '../../../domain/model/Money';

export interface CardChargeResult {
  readonly approved: boolean;
  readonly reference: string;
  readonly declineReason?: string;
}

/** Charges a card, in the application's own terms. */
export interface Payments {
  chargeCard(cardToken: string, amount: Money, orderId: string): Promise<CardChargeResult>;
}
