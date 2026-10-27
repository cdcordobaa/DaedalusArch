import type { RatewiseClient, RatewiseLatestRequest, RatewiseLatestResult } from 'ratewise-sdk';
import type { FxRatesPort } from '../../../application/ports/out/FxRatesPort';

export class RatewiseFxRatesAdapter implements FxRatesPort {
  constructor(private readonly client: RatewiseClient) {}

  latest(request: RatewiseLatestRequest): Promise<RatewiseLatestResult> {
    return this.client.latest(request);
  }
}
