export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type CardDeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** The provider declined the card; distinct from the provider being unreachable. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason, message = 'the card was declined') {
    super(message);
    this.name = 'CardDeclinedError';
  }
}

/** The payment provider could not be reached; distinct from a declined card. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
