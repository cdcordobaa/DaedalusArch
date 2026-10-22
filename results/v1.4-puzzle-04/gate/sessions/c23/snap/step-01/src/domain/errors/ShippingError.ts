export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingError';
  }
}

/** The carrier could not give us a price right now. */
export class QuoteUnavailableError extends ShippingError {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteUnavailableError';
  }
}
