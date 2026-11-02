/** A rate the application may use: units of `currency` per one euro. */
export interface UsableRate {
  readonly currency: string;
  readonly mid: number;
  /** Decimals the currency is written with, as given by Ratewise with the rate. */
  readonly minorUnits: number;
  /** Epoch ms the rate was fixed at. */
  readonly asOf: number;
}

export interface ExchangeRates {
  /**
   * The latest usable EUR rate for the currency; undefined when Ratewise answered
   * without one; 'unavailable' when Ratewise could not answer.
   */
  fromEuro(currency: string): Promise<UsableRate | undefined | 'unavailable'>;
}
