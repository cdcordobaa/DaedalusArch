import { FastshipUnavailableError } from 'fastship-sdk';
import type { FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { CarrierUnavailableError, ShippingError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';

/** Parcels heavier than this may only use freight; lighter or equal ones never may. */
const FREIGHT_THRESHOLD_GRAMS = 20000;

export class FastshipRateAdapter implements RatePort {
  constructor(
    private readonly client: FastshipClient,
    private readonly currency: string,
  ) {}

  async cheapest(parcel: Parcel): Promise<Quote> {
    let rates;
    try {
      ({ rates } = await this.client.rates({
        origin: { country: parcel.from },
        destination: { country: parcel.to },
        parcel: { weight: { value: parcel.weightGrams, unit: 'g' } },
      }));
    } catch (e) {
      if (e instanceof FastshipUnavailableError) throw new CarrierUnavailableError('carrier rates are currently unavailable');
      throw e;
    }

    let best: Quote | undefined;
    const freightOnly = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    for (const rate of rates) {
      if ((rate.serviceCode === 'FREIGHT') !== freightOnly) continue;
      const value = Number(rate.amount.value);
      if (!Number.isFinite(value)) continue;
      if (rate.amount.currency !== this.currency) {
        throw new ShippingError(`unexpected carrier currency ${rate.amount.currency}`);
      }
      const price = Money.of(value, this.currency);
      if (!best || price.isLessThan(best.price)) best = { price, service: rate.serviceName };
    }
    if (!best) throw new ShippingError('no carrier service available for this parcel');
    return best;
  }
}
