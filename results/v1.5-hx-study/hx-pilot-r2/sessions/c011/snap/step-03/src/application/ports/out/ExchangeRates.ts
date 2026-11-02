/** A EUR-based rate as reported by the rate provider. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
  /** Number of decimals the currency is written with, as given with the rate. */
  readonly decimals: number;
}

/** Thrown by ExchangeRates when the provider cannot be reached. */
export class ExchangeRatesUnavailableError extends Error {}

export interface ExchangeRates {
  /**
   * Latest EUR rate to the currency; undefined when the provider has none.
   * Throws ExchangeRatesUnavailableError when the provider is unavailable.
   */
  latestFromEur(currency: string): Promise<ExchangeRate | undefined>;
}
