/** A usable EUR -> target rate, in the application's own terms. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
}

export interface ExchangeRates {
  /** The latest rate from EUR to the currency, or null when there is no rate that may be used. */
  euroTo(currency: string): Promise<EuroRate | null>;
}
