/** A usable-in-principle rate from euros to one currency. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  /** Number of decimals the currency is written with, as given by Ratewise. */
  readonly minorUnits: number;
  readonly fixedAt: Date;
}
