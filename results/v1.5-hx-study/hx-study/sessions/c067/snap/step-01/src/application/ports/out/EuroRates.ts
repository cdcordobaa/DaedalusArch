import type { ExchangeRate } from '../../../domain/model/ExchangeRate';

/** The latest rate from EUR to one currency; undefined when the provider has none to give. */
export interface EuroRates {
  latestFromEuro(currency: string): Promise<ExchangeRate | undefined>;
}
