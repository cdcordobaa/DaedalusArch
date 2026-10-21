import { normalizeCountry, type TaxRates } from '../domain/tax/TaxRates.js';

/** Finance changes a country's rate; it affects orders placed afterwards only. */
export class SetTaxRate {
  constructor(private readonly rates: TaxRates) {}

  async execute(country: string, rate: number): Promise<void> {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('Tax rate must be a fraction between 0 and 1');
    await this.rates.setRate(normalizeCountry(country), rate);
  }
}
