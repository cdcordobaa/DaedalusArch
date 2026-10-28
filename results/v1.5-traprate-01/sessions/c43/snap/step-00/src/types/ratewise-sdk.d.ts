// Typings of the Ratewise exchange-rate SDK (ratewise-sdk 2.8), as shipped by the vendor.
declare module 'ratewise-sdk' {
  export interface RatewiseLatestRequest {
    base: string;
    symbols: string[];
  }
  export interface RatewiseRate {
    symbol: string;
    mid: number;
    /** ISO 8601 time the rate was fixed at. */
    asOf: string;
    quality: 'FIRM' | 'INDICATIVE';
    minorUnits: number;
  }
  export interface RatewiseLatestResult {
    base: string;
    rates: RatewiseRate[];
  }
  export interface RatewiseCurrenciesRequest {
    status: 'ACTIVE' | 'RETIRED' | 'ALL';
  }
  export interface RatewiseCurrency {
    isoCode: string;
    displayName: string;
    minorUnits: number;
    status: 'ACTIVE' | 'RETIRED';
  }
  export class RatewiseUnavailableError extends Error {}
  export class RatewiseClient {
    constructor(options: { apiKey: string });
    latest(request: RatewiseLatestRequest): Promise<RatewiseLatestResult>;
    currencies(request: RatewiseCurrenciesRequest): Promise<RatewiseCurrency[]>;
  }
}
