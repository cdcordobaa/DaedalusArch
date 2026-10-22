export class ShippingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShippingError';
  }
}
