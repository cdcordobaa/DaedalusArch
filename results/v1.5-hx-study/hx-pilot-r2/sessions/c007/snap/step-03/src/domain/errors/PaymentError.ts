export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The provider declined the card; nothing was charged. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: 'insufficient_funds' | 'expired_card' | 'other', message: string) {
    super(message);
    this.name = 'CardDeclinedError';
  }
}

/** The payment provider could not be reached; nothing was charged. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
