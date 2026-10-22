export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingError';
  }
}

export class CarrierUnavailableError extends ShippingError {
  constructor(message: string) {
    super(message);
    this.name = 'CarrierUnavailableError';
  }
}
