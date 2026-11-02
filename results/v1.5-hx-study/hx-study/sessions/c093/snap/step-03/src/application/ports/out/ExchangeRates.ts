/** A usable rate from euro to one currency. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  /** Number of decimals the currency is written with, as given by Ratewise. */
  readonly decimals: number;
  /** True when Ratewise was unavailable and an earlier rate was used. */
  readonly estimated?: boolean;
}

/** Source of euro exchange rates, in the application's own terms. */
export interface ExchangeRates {
  /** The latest usable EUR→currency rate, or undefined when there is none. */
  euroTo(currency: string): Promise<EuroRate | undefined>;
}
