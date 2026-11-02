/** A usable mid rate from EUR to one currency, or null when none can be used. */
export interface ExchangeRates {
  eurTo(currency: string): Promise<number | null>;
}
