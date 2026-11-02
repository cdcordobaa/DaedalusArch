/** A rate as the application sees it, whatever the provider calls its fields. */
export interface ExchangeRate {
  readonly currency: string;
  readonly mid: number;
  /** When the provider fixed the rate. */
  readonly fixedAt: Date;
  readonly indicative: boolean;
}

/** Thrown by an adapter when the provider is unavailable (as opposed to answering with no rates). */
export class ExchangeRatesUnavailableError extends Error {
  constructor() {
    super('Exchange rates are unavailable');
    this.name = 'ExchangeRatesUnavailableError';
  }
}

/** Latest rates from EUR. May return rates for other currencies than asked; callers must check. */
export interface ExchangeRates {
  latestFromEur(currency: string): Promise<ExchangeRate[]>;
}
