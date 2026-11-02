import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Thrown by an ExchangeRates implementation when the provider is unavailable. */
export class RatesUnavailableError extends Error {}

export interface ExchangeRates {
  /** Latest EUR -> `currency` rate as the provider reports it, or undefined when it has none. */
  latestFromEur(currency: string): Promise<ExchangeRate | undefined>;
}
