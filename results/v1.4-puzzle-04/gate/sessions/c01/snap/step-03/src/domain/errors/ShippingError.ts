export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingError';
  }
}

export class RatesUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RatesUnavailableError';
  }
}
