import { PaymentError } from './PaymentError';

export type CardDeclineReason = 'not-enough-money' | 'card-out-of-date' | 'unspecified';

export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason) {
    super(`card declined: ${reason}`);
    this.name = 'CardDeclinedError';
  }
}
