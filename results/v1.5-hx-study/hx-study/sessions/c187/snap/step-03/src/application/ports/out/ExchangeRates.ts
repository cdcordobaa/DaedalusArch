/** A usable EUR -> target rate, in the application's own terms. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  /** Number of decimals the currency is written with, as given by Ratewise. */
  readonly decimals: number;
  /** true when Ratewise was unavailable and an earlier usable rate was used. */
  readonly estimated?: boolean;
}

export interface ExchangeRates {
  /** The latest rate from EUR to the currency, or null when there is no rate that may be used. */
  euroTo(currency: string): Promise<EuroRate | null>;
}
