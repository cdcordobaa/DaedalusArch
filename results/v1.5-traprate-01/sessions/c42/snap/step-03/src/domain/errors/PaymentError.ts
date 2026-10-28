export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type DeclineReason = 'insufficient_funds' | 'expired_card' | 'other';

/** The payment provider declined the card; nothing was charged. */
export class PaymentDeclinedError extends PaymentError {
  constructor(readonly reason: DeclineReason) {
    super(`the card was declined: ${reason}`);
    this.name = 'PaymentDeclinedError';
  }
}

/** The payment provider could not be reached; the card was not charged. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
