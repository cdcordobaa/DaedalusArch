/** Source of euro exchange rates. */
export interface ExchangeRates {
  /** The latest usable mid rate from EUR to the currency, or undefined when there is none. */
  euroMidRate(currency: string): Promise<number | undefined>;
}
