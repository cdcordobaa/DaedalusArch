/** A rate from euro to a currency, in the application's own terms. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
}

export interface ExchangeRates {
  /** The latest rates returned for euro to the currency; undefined when there is none. */
  latestFromEuro(currency: string): Promise<EuroRate[] | undefined>;
}
