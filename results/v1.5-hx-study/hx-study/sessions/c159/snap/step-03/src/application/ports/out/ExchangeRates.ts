export interface ExchangeRate {
  /** Currency the rate converts to. */
  readonly currency: string;
  readonly mid: number;
  readonly asOf: Date;
  readonly indicative: boolean;
  /** Number of decimals Ratewise gives for the currency. */
  readonly minorUnits: number;
}

export interface ExchangeRates {
  /** Latest EUR -> currency rates; null when Ratewise has none available. */
  latestFromEur(currency: string): Promise<readonly ExchangeRate[] | null>;
}
