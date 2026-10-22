import type { FastshipClient } from 'fastship-sdk';
import type { CarrierRateLine, RatesPort } from '../../../application/ports/out/RatesPort';

export class FastshipRatesAdapter implements RatesPort {
  constructor(private readonly client: FastshipClient) {}

  async ratesFor(from: string, to: string, weightGrams: number): Promise<CarrierRateLine[]> {
    const response = await this.client.rates({ origin: { country: from }, destination: { country: to }, parcel: { weight: { value: weightGrams, unit: 'g' } } });
    return response.rates;
  }
}
