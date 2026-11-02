/** `estimated` is true when Ratewise was unavailable and an earlier rate was used. */
export interface UsableRate {
  readonly mid: number;
  readonly estimated: boolean;
}

/** The latest usable EUR -> `currency` mid rate, or undefined when there is none. */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<UsableRate | undefined>;
}
