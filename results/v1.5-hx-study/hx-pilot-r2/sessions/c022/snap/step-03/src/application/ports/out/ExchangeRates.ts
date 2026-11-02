export interface EurRate {
  readonly mid: number;
  /** True when Ratewise was unavailable and an earlier usable rate was used. */
  readonly estimated: boolean;
}

/** A usable mid rate from EUR to one currency, or null when none can be used. */
export interface ExchangeRates {
  eurTo(currency: string): Promise<EurRate | null>;
}
