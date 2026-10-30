export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The card processor could not be reached; the order may be invoiced instead. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
