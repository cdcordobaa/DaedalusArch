/** A rate as the application sees it: how many units of `currency` one euro buys. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
  /** How many decimals the currency is written with. */
  readonly decimals: number;
}

/** Thrown by ExchangeRates when the rate provider is unavailable. */
export class RatesUnavailableError extends Error {}

/** Latest euro exchange rate for one currency, or undefined when the provider answered without one. Throws RatesUnavailableError when the provider is unavailable. */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<EuroRate | undefined>;
}
