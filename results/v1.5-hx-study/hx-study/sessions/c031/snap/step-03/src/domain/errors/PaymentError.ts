export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export type CardDeclineReason = 'INSUFFICIENT_FUNDS' | 'EXPIRED' | 'OTHER';

/** The card was declined by the provider; the card was not charged. */
export class CardDeclinedError extends PaymentError {
  constructor(readonly reason: CardDeclineReason, message: string) {
    super(message);
    this.name = 'CardDeclinedError';
  }
}

/** The payment provider could not be reached; the card was not charged. */
export class PaymentProviderUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}
