import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** Latest euro exchange rates. Resolves to null when there is no firm rate for exactly that currency. */
export interface ExchangeRates {
  latestFromEuro(currency: string): Promise<ExchangeRate | null>;
}
