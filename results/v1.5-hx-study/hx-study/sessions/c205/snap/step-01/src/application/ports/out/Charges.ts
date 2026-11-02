import type { Money } from '../../../domain/model/Money';
import type { ChargeReceipt } from '../../../domain/model/ChargeReceipt';

/** Charges a card, in the application's own terms. Rejects with PaymentError when the card is declined. */
export interface Charges {
  charge(cardToken: string, amount: Money, orderId: string): Promise<ChargeReceipt>;
}
