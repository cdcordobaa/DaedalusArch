import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Thrown when the provider cannot be reached or does not answer. */
export class ExchangeRatesUnavailableError extends Error {}

/**
 * Rates from euro. Answers every rate the provider returned for the request, or none.
 * Throws ExchangeRatesUnavailableError when the provider is unavailable.
 */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<ExchangeRate[]>;
}
