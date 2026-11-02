/** A rate from euro to another currency, in the application's own terms. */
export interface ExchangeRate {
  /** Currency the rate converts from. */
  readonly base: string;
  /** Currency the rate converts to. */
  readonly currency: string;
  readonly mid: number;
  /** When the rate was fixed. */
  readonly fixedAt: Date;
  readonly indicative: boolean;
}
