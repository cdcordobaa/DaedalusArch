import { PaymentError } from './PaymentError';

export type CardDeclineReason = 'insufficientFunds' | 'cardExpired' | 'other';

/** The card was declined by the payment provider; nothing was charged. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason, message: string) {
    super(message);
    this.name = 'CardDeclinedError';
  }
}
