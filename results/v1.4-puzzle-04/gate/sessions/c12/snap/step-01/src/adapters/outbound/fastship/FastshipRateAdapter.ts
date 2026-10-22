import type { FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { ShippingError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async cheapest(parcel: Parcel): Promise<Quote> {
    const { rates } = await this.client.rates({
      origin: { country: parcel.from },
      destination: { country: parcel.to },
      parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
    });
    const priced = rates.map((rate) => ({
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
      service: rate.serviceName,
    }));
    if (priced.length === 0) throw new ShippingError('no Fastship service available for this parcel');
    return priced.reduce((best, q) => (q.price.isLessThan(best.price) ? q : best));
  }
}
