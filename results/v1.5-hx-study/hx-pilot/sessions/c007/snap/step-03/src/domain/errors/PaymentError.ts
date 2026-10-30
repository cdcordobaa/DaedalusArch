export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** The card was declined by the processor; `reason` is the processor's decline code, if any. */
export class PaymentDeclinedError extends PaymentError {
  constructor(message: string, readonly reason?: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
  }
}

/** The card processor could not be reached; the order may be invoiced instead. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
