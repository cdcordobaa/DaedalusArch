/** A rate as reported by the rate provider, in the application's own terms. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
  /** Decimals the currency is written with, as given with the rate. */
  readonly decimals: number;
}

/** Latest rates from euro. Resolves to undefined when the provider is unavailable (an empty list means it answered without a rate). */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<ExchangeRate[] | undefined>;
}
