export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type DeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** The provider refused the card; no charge was made. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super('the card was declined');
    this.name = 'CardDeclinedError';
  }
}

/** The payment provider could not be reached; no charge was made. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
