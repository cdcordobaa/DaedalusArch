export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The payment processor could not be reached; the payment was not taken. */
export class PaymentServiceUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentServiceUnavailableError';
  }
}
