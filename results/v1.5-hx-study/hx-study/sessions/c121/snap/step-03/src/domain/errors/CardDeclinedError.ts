import { PaymentError } from './PaymentError';

export type DeclineReason = 'not-enough-money' | 'card-out-of-date' | 'other';

/** The card issuer declined the charge. This is a real decline, not an outage. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super(`card payment declined: ${reason}`);
    this.name = 'CardDeclinedError';
  }

  customerMessage(): string {
    switch (this.reason) {
      case 'not-enough-money':
        return 'Your card has insufficient funds.';
      case 'card-out-of-date':
        return 'Your card has expired.';
      default:
        return 'Your card was declined.';
    }
  }
}
