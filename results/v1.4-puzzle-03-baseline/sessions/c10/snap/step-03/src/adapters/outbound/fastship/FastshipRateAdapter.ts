import { FastshipUnavailableError, type FastshipClient } from 'fastship-sdk';
import { CarrierUnavailableError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { CarrierRate, RatePort } from '../../../application/ports/out/RatePort';

/** Parcels heavier than 20 kg must go by freight; lighter ones must not. */
const FREIGHT_MIN_GRAMS_EXCLUSIVE = 20000;

export class FastshipRateAdapter implements RatePort {
  constructor(private readonly client: FastshipClient) {}

  async cheapest(parcel: Parcel): Promise<CarrierRate | undefined> {
    let response;
    try {
      response = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      });
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new CarrierUnavailableError(e.message);
      throw e;
    }
    let best: CarrierRate | undefined;
    const freightOnly = parcel.weightGrams > FREIGHT_MIN_GRAMS_EXCLUSIVE;
    for (const rate of response.rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
      const price = Money.of(Number(rate.amount.value), rate.amount.currency);
      if (!best || price.isLessThan(best.price)) best = { price, service: rate.serviceName };
    }
    return best;
  }
}
