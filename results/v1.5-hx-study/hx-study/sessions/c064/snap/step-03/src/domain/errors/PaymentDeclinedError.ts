import { PaymentError } from './PaymentError';

export type DeclineReason = 'InsufficientFunds' | 'CardExpired' | 'Other';

/** The card was refused by the payment provider. */
export class PaymentDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super('the card was declined');
    this.name = 'PaymentDeclinedError';
  }
}
