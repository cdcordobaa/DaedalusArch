import type { FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async rates(parcel: Parcel): Promise<Quote[]> {
    const response = await this.client.rates({
      origin: { country: parcel.from },
      destination: { country: parcel.to },
      parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
    });
    return response.rates.map((rate) => ({
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
      service: rate.serviceName,
    }));
  }
}
