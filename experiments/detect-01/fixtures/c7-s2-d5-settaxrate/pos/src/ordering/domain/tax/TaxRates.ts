/** Domain port: tax rate per country. */
export interface TaxRates {
  rateFor(country: string): Promise<number>;
  setRate(country: string, rate: number): Promise<void>;
}

export function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}
