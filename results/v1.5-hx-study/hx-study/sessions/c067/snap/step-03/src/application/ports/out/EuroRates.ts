import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Thrown when the provider cannot be reached or does not answer. */
export class RatesUnavailableError extends Error {
  constructor() {
    super('rate provider unavailable');
    this.name = 'RatesUnavailableError';
  }
}

/**
 * The latest rate from EUR to one currency; undefined when the provider answered but has none to give.
 * Throws RatesUnavailableError when the provider does not answer.
 */
export interface EuroRates {
  latestFromEuro(currency: string): Promise<ExchangeRate | undefined>;
}
