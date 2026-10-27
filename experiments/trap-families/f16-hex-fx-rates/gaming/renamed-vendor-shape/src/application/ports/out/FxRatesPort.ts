/** One quoted exchange rate from euros. */
export interface LiveRate {
  symbol: string;
  mid: number;
  asOf: string;
  quality: 'FIRM' | 'INDICATIVE';
  minorUnits: number;
}

export interface FxRatesPort {
  ratesFor(currency: string): Promise<LiveRate[]>;
}
