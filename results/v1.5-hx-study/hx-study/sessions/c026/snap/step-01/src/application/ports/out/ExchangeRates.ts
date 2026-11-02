/** The usable mid rate from EUR to a currency, or undefined when there is none. */
export interface ExchangeRates {
  euroTo(currency: string): Promise<number | undefined>;
}
