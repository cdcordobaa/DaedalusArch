export interface EurRate {
  readonly mid: number;
  /** Number of decimals the currency is written with, as given by Ratewise. */
  readonly minorUnits: number;
  /** true when Ratewise was unavailable and an earlier usable rate was used. */
  readonly estimated: boolean;
}

/** A usable EUR -> target rate, or null when none may be used. */
export interface ExchangeRates {
  eurTo(currency: string): Promise<EurRate | null>;
}
