import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Source of exchange rates. */
export interface ExchangeRates {
  /** All rates returned for the latest EUR rate to the currency; empty when none is available; null when the source is unavailable. */
  latestFromEur(currency: string): Promise<ExchangeRate[] | null>;
}
