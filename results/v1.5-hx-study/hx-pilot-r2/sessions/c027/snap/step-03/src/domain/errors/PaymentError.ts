export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The card was declined by the provider. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: 'insufficient_funds' | 'expired_card' | 'other') {
    super('the card was declined');
    this.name = 'CardDeclinedError';
  }
}

/** The card payment provider could not be reached. */
export class PaymentProviderUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}
