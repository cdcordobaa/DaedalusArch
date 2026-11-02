/** A rate from euro to one currency, in the application's own terms. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  readonly asOf: Date;
  readonly indicative: boolean;
}

export interface ExchangeRates {
  /** The latest rates Ratewise has for EUR to the given currency; empty when it has none or is unavailable. */
  latestFromEuro(currency: string): Promise<EuroRate[]>;
}
