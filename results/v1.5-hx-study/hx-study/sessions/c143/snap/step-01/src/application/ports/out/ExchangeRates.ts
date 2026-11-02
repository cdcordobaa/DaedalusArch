/** A usable EUR -> target rate: the mid rate, or null when none may be used. */
export interface ExchangeRates {
  eurTo(currency: string): Promise<number | null>;
}
