/** Source of exchange rates, in the application's own terms. */
export interface ExchangeRates {
  /** The latest usable mid rate from EUR to the currency, or undefined when there is none. */
  latestFromEuro(currency: string): Promise<number | undefined>;
}
