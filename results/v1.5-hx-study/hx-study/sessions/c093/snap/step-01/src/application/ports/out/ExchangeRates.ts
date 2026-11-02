/** A usable rate from euro to one currency. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
}

/** Source of euro exchange rates, in the application's own terms. */
export interface ExchangeRates {
  /** The latest usable EUR→currency rate, or undefined when there is none. */
  euroTo(currency: string): Promise<EuroRate | undefined>;
}
