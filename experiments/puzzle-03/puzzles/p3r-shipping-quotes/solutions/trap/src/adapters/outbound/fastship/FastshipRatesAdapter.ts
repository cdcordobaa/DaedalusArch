import type { FastshipClient, FastshipRateRequest, FastshipRateResponse } from 'fastship-sdk';
import type { RatesPort } from '../../../application/ports/out/RatesPort';

export class FastshipRatesAdapter implements RatesPort {
  constructor(private readonly client: FastshipClient) {}

  rates(request: FastshipRateRequest): Promise<FastshipRateResponse> {
    return this.client.rates(request);
  }
}
