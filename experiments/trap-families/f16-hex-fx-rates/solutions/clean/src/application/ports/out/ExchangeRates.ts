import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** The latest rate from euros to a currency, in the application's own terms; undefined when there is none. */
export interface ExchangeRates {
  latestFor(currency: string): Promise<ExchangeRate | undefined>;
}
