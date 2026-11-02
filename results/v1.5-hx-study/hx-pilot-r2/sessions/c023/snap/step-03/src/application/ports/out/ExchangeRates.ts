/** A usable EUR -> `currency` mid rate. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  /** Decimals the currency is written with, as given by Ratewise with the rate. */
  readonly minorUnits: number;
  /** true when taken from an earlier Ratewise answer because Ratewise was unavailable. */
  readonly estimated: boolean;
}

export interface ExchangeRates {
  /** Latest usable rate from EUR to the currency, or null when there is none. */
  fromEuro(currency: string): Promise<EuroRate | null>;
}
