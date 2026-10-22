import { FastshipUnavailableError } from 'fastship-sdk';
import type { FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { RatesUnavailableError, ShippingError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async cheapest(parcel: Parcel): Promise<Quote> {
    let rates;
    try {
      ({ rates } = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      }));
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new RatesUnavailableError('Fastship rates are unavailable');
      throw e;
    }
    let best: Quote | undefined;
    for (const rate of rates) {
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      const price = Money.of(value, rate.amount.currency);
      if (!best || price.isLessThan(best.price)) best = { price, service: rate.serviceName };
    }
    if (!best) throw new ShippingError('no Fastship service available for this parcel');
    return best;
  }
}
