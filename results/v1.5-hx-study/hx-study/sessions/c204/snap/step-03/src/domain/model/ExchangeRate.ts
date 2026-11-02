/** A rate from euro to another currency, as quoted by the rate provider. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
  /** Number of decimals the currency is written with. */
  readonly decimals: number;
}
