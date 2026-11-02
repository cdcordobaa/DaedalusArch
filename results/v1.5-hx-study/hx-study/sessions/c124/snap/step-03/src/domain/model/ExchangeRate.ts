/** A rate from euro to another currency, as the exchange-rate provider quoted it. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
  /** Decimals the currency is written with, as the provider gave them with the rate. */
  readonly decimals: number;
}
