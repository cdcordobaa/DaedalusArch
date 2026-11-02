import { PaymentError } from './PaymentError';

export type CardDeclineReason = 'NO_FUNDS' | 'CARD_EXPIRED' | 'OTHER';

/** The card was declined; the charge was not made. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason, message: string) {
    super(message);
    this.name = 'CardDeclinedError';
  }

  /** The message to show to the customer. */
  customerMessage(): string {
    switch (this.reason) {
      case 'NO_FUNDS':
        return 'Your card has insufficient funds.';
      case 'CARD_EXPIRED':
        return 'Your card has expired.';
      default:
        return 'Your card was declined.';
    }
  }
}
