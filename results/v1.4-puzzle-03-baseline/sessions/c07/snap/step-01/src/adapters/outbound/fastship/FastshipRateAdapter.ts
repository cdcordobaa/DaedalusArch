import type { FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { ShippingError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

export class FastshipRateAdapter implements RatePort {
  constructor(
    private readonly client: FastshipClient,
    private readonly currency: string,
  ) {}

  async cheapest(parcel: Parcel): Promise<Quote> {
    const response = await this.client.rates({
      origin: { country: parcel.from },
      destination: { country: parcel.to },
      parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
    });
    let best: Quote | undefined;
    for (const rate of response.rates) {
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      if (rate.amount.currency !== this.currency) {
        throw new Error(`Fastship returned ${rate.amount.currency}, expected ${this.currency}`);
      }
      const price = Money.of(value, this.currency);
      if (!best || price.isLessThan(best.price)) best = { price, service: rate.serviceName };
    }
    if (!best) throw new ShippingError('no Fastship service available for this parcel');
    return best;
  }
}
