import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Rates from euro. Answers every rate the provider returned for the request, or none. */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<ExchangeRate[]>;
}
