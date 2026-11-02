/** The card payment provider could not be reached or is down. */
export class PaymentsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsUnavailableError';
  }
}
