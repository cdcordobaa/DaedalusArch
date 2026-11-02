/** A rate from euro to one currency, in the application's own terms. */
export interface EuroRate {
  readonly currency: string;
  readonly mid: number;
  readonly asOf: Date;
  readonly indicative: boolean;
  /** Decimals the currency is written with, as given by Ratewise with the rate. */
  readonly minorUnits: number;
}

export interface ExchangeRates {
  /** The latest rates Ratewise has for EUR to the given currency; empty when it has none; null when Ratewise is unavailable. */
  latestFromEuro(currency: string): Promise<EuroRate[] | null>;
}
