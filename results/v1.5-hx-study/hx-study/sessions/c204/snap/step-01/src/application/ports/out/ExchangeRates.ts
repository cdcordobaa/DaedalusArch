import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Latest rates from euro to the given currency; empty when none is available. */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<ExchangeRate[]>;
}
