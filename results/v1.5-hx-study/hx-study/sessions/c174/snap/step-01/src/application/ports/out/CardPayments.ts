import type { Money } from '../../../domain/model/Money';

/** Takes a card payment, in the application's own terms. Rejects with a PaymentError when the card is not charged. */
export interface CardPayments {
  /** Charges the card and returns the processor's charge id. */
  charge(orderId: string, amount: Money, cardToken: string): Promise<string>;
}
