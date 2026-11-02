export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type CardDeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** The processor declined the card; the payment was not taken. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason, message: string) {
    super(message);
    this.name = 'CardDeclinedError';
  }
}

/** The payment processor could not be reached; the payment was not taken. */
export class PaymentServiceUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentServiceUnavailableError';
  }
}
