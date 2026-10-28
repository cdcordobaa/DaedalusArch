export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The payment provider could not be reached; the card was not charged. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
