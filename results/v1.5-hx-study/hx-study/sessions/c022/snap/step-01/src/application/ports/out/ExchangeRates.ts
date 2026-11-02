/** A usable EUR -> target rate; null when no usable rate exists. */
export interface ExchangeRates {
  eurTo(currency: string): Promise<number | null>;
}
