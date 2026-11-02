/** A usable EUR -> `currency` mid rate. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  /** true when taken from an earlier Ratewise answer because Ratewise was unavailable. */
  readonly estimated: boolean;
}

export interface ExchangeRates {
  /** Latest usable rate from EUR to the currency, or null when there is none. */
  fromEuro(currency: string): Promise<EuroRate | null>;
}
