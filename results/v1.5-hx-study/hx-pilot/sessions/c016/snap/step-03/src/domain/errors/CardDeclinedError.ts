import { PaymentError } from './PaymentError';

export type CardDeclineReason = 'insufficient-funds' | 'expired' | 'other';

export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason) {
    super('the card was declined');
    this.name = 'CardDeclinedError';
  }
}
