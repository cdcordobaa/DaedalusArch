import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

export interface ExchangeRates {
  /** Latest EUR -> `currency` rate as the provider reports it, or undefined when it has none. */
  latestFromEur(currency: string): Promise<ExchangeRate | undefined>;
}
