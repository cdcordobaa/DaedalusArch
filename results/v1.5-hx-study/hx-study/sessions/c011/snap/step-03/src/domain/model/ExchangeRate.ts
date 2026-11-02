/** A EUR -> `currency` rate as reported by the rate provider. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  /** ISO 8601 time the rate was fixed at. */
  readonly fixedAt: string;
  readonly indicative: boolean;
  /** Number of decimals the currency is written with. */
  readonly decimals: number;
}
