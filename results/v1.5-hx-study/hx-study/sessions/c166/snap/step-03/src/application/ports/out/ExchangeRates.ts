/** Source of exchange rates, in the application's own terms. */
export interface ExchangeRates {
  /**
   * The latest usable mid rate from EUR to the currency, or undefined when there is none.
   * estimated is true when the source was unavailable and an earlier usable rate was reused.
   * decimals is the number of decimals the currency is written with.
   */
  latestFromEuro(currency: string): Promise<{ rate: number; decimals: number; estimated: boolean } | undefined>;
}
