/** A rate as the application sees it, whatever the provider calls its fields. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  /** When the provider fixed the rate. */
  readonly fixedAt: Date;
  readonly indicative: boolean;
}

/** Latest rates from EUR. May return rates for other currencies than asked; callers must check. */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<ExchangeRate[]>;
}
