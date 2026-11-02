/** `estimated` is true when Ratewise was unavailable and an earlier rate was used. */
export interface UsableRate {
  readonly mid: number;
  /** Decimals the currency is written with, as given by Ratewise. */
  readonly minorUnits: number;
  readonly estimated: boolean;
}

/** The latest usable EUR -> `currency` mid rate, or undefined when there is none. */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<UsableRate | undefined>;
}
