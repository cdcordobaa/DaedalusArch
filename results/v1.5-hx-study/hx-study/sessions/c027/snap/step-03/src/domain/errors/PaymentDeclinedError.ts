import { PaymentError } from './PaymentError';

export type DeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** The payment provider declined the card; the order must neither be placed nor invoiced. */
export class PaymentDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super('the card was declined');
    this.name = 'PaymentDeclinedError';
  }
}
