/** What one euro is worth in another currency, as quoted at a point in time. */
export interface ExchangeRate {
  readonly currency: string;
  readonly perEuro: number;
  readonly fixedAt: Date;
  /** An indication only, not a rate prices may be shown at. */
  readonly indicative: boolean;
  /** How many decimals the currency is written with. */
  readonly decimals: number;
}
