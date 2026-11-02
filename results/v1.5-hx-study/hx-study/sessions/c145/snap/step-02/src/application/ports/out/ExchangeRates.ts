/** A usable rate and the time it was fixed at. */
export interface RateQuote {
  readonly mid: number;
  readonly fixedAt: Date;
}

/** Source of euro exchange rates. */
export interface ExchangeRates {
  /**
   * The latest usable rate from EUR to the currency, undefined when the source
   * answered without one, or 'unavailable' when the source could not be reached.
   */
  euroMidRate(currency: string): Promise<RateQuote | undefined | 'unavailable'>;
}
