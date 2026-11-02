/** A rate as the application sees it: how many units of `currency` one euro buys. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
}

/** Latest euro exchange rate for one currency, or undefined when none can be had. */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<EuroRate | undefined>;
}
