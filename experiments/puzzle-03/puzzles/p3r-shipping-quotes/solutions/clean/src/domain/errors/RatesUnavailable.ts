import { ShippingError } from './ShippingError';

/** The carrier could not give rates right now. */
export class RatesUnavailable extends ShippingError {
  constructor(reason: string) {
    super(`carrier rates unavailable: ${reason}`);
    this.name = 'RatesUnavailable';
  }
}
