import { PricingError } from './PricingError';

/** Exchange rates cannot be fetched right now. */
export class RatesUnavailable extends PricingError {
  constructor(reason: string) {
    super(`exchange rates unavailable: ${reason}`);
    this.name = 'RatesUnavailable';
  }
}
