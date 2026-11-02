/** A usable-in-principle rate from euros to one currency. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  readonly fixedAt: Date;
}
