/** The card payment provider could not be reached or is down; the card was not charged. */
export class PaymentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
