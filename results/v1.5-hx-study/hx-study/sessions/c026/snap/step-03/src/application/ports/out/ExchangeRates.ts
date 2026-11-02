export interface EuroRate {
  readonly mid: number;
  /** Number of decimals the currency is written with. */
  readonly decimals: number;
  /** True when the rate is an earlier one used because the provider was unavailable. */
  readonly estimated: boolean;
}

/** The usable mid rate from EUR to a currency, or undefined when there is none. */
export interface ExchangeRates {
  euroTo(currency: string): Promise<EuroRate | undefined>;
}
