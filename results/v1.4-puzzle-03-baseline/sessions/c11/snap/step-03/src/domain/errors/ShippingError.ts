export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingError';
  }
}

/** The carrier could not be reached, so no live rates are available. */
export class RatesUnavailableError extends ShippingError {
  constructor(message: string) {
    super(message);
    this.name = 'RatesUnavailableError';
  }
}
