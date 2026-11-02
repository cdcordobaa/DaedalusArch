/** A rate the application may use: units of `currency` per one euro. */
export interface UsableRate {
  readonly currency: string;
  readonly mid: number;
}

export interface ExchangeRates {
  /** The latest usable EUR rate for the currency, or undefined when there is none. */
  fromEuro(currency: string): Promise<UsableRate | undefined>;
}
