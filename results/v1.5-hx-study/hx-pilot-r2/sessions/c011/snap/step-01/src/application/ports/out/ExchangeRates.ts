/** A EUR-based rate as reported by the rate provider. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
}

export interface ExchangeRates {
  /** Latest EUR rate to the currency; undefined when the provider has none. */
  latestFromEur(currency: string): Promise<ExchangeRate | undefined>;
}
