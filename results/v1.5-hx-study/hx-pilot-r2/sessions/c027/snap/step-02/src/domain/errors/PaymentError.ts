export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The card payment provider could not be reached. */
export class PaymentProviderUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}
