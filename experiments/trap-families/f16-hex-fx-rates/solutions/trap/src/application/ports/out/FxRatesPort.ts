import type { RatewiseLatestRequest, RatewiseLatestResult } from 'ratewise-sdk';

export interface FxRatesPort {
  latest(request: RatewiseLatestRequest): Promise<RatewiseLatestResult>;
}
