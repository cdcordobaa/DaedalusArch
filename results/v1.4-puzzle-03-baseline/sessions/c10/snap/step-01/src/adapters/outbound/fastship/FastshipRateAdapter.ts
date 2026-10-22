import type { FastshipClient } from 'fastship-sdk';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { CarrierRate, RatePort } from '../../../application/ports/out/RatePort';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async cheapest(parcel: Parcel): Promise<CarrierRate | undefined> {
    const response = await this.client.rates({
      origin: { country: parcel.from },
      destination: { country: parcel.to },
      parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
    });
    let best: CarrierRate | undefined;
    for (const rate of response.rates) {
      const price = Money.of(Number(rate.amount.value), rate.amount.currency);
      if (!best || price.isLessThan(best.price)) best = { price, service: rate.serviceName };
    }
    return best;
  }
}
