export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type DeclineReason = 'InsufficientFunds' | 'CardExpired' | 'Other';

/** The card was declined by the payment provider. */
export class PaymentDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason, message: string) {
    super(message);
    this.name = 'PaymentDeclinedError';
  }
}

/** The payment provider could not be reached; no card payment was attempted. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
