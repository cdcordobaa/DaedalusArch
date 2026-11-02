/** The latest usable EUR -> `currency` mid rate, or undefined when there is none. */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<number | undefined>;
}
