import { FastshipUnavailableError } from 'fastship-sdk';
import type { FastshipClient, FastshipRate } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { QuoteUnavailableError } from '../../../domain/errors/ShippingError';
import type { Parcel } from '../../../domain/model/Parcel';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async rates(parcel: Parcel): Promise<FastshipRate[]> {
    try {
      const response = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      });
      return response.rates;
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new QuoteUnavailableError('Fastship is unavailable');
      throw e;
    }
  }
}
