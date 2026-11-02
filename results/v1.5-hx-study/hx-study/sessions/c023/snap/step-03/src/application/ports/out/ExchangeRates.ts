import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Thrown when the rate provider cannot be reached. */
export class RatesUnavailableError extends Error {}

/**
 * Latest euro exchange rates. Resolves to null when there is no firm rate for exactly that currency.
 * Throws RatesUnavailableError when the provider is down.
 */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<ExchangeRate | null>;
}
