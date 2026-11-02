import { PaymentError } from './PaymentError';

export type DeclineReason = 'insufficient-funds' | 'card-expired' | 'other';

/** The card was declined by the payment processor. */
export class PaymentDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super('the card was declined');
    this.name = 'PaymentDeclinedError';
  }

  customerMessage(): string {
    switch (this.reason) {
      case 'insufficient-funds':
        return 'Your card has insufficient funds.';
      case 'card-expired':
        return 'Your card has expired.';
      default:
        return 'Your card was declined.';
    }
  }
}
