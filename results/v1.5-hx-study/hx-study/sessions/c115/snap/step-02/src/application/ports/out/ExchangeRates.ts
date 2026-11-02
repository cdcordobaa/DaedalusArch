/** A usable EUR -> target mid rate. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  /** True when taken from an earlier answer because Ratewise was unavailable. */
  readonly estimated?: boolean;
}

export interface ExchangeRates {
  /** Latest usable rate from EUR to the currency, or null when there is none. */
  euroTo(currency: string): Promise<EuroRate | null>;
}
