import { PaymentError } from './PaymentError';

export type DeclineReason = 'not-enough-money' | 'card-lapsed' | 'refused';

/** The card was refused by the payment provider. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super(`the card was declined: ${reason}`);
    this.name = 'CardDeclinedError';
  }
}
