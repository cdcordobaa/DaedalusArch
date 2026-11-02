/** A rate from euro to another currency, as the exchange-rate provider quoted it. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
  readonly indicative: boolean;
}
