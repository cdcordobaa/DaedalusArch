import type { TaxRate } from './TaxRate.js';

/** Domain port: tax rate per country. */
export interface TaxRates {
  rateFor(country: string): Promise<TaxRate>;
  setRate(country: string, rate: TaxRate): Promise<void>;
}

export function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}
