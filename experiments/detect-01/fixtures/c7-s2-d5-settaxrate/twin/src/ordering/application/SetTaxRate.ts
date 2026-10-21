import { TaxRate } from '../domain/tax/TaxRate.js';
import { normalizeCountry, type TaxRates } from '../domain/tax/TaxRates.js';

/** Finance changes a country's rate; it affects orders placed afterwards only. */
export class SetTaxRate {
  constructor(private readonly rates: TaxRates) {}

  async execute(country: string, rate: number): Promise<void> {
    await this.rates.setRate(normalizeCountry(country), new TaxRate(rate));
  }
}
