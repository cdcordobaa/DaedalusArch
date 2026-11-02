export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The payment provider could not be reached; the order can still be invoiced. */
export class PaymentProviderUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}
