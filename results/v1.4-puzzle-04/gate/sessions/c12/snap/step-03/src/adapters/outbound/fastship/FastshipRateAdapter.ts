import { FastshipUnavailableError, type FastshipClient } from 'fastship-sdk';
import type { RatePort } from '../../../application/ports/out/RatePort';
import { ShippingError } from '../../../domain/errors/ShippingError';
import { Money } from '../../../domain/model/Money';
import type { Parcel } from '../../../domain/model/Parcel';
import type { Quote } from '../../../domain/model/Quote';
import { PriceTable } from '../../../domain/services/PriceTable';

/** Parcels heavier than this must use freight; lighter or equal ones must not. */
const FREIGHT_THRESHOLD_GRAMS = 20_000;

export class FastshipRateAdapter implements RatePort {
  constructor(
    private readonly client: FastshipClient,
    private readonly fallback: PriceTable = new PriceTable(),
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
      if (e instanceof FastshipUnavailableError) return this.fallback.quote(parcel);
      throw e;
    }
    const needsFreight = parcel.weightGrams > FREIGHT_THRESHOLD_GRAMS;
    const allowed = rates.filter((rate) => (rate.serviceCode === 'FREIGHT') === needsFreight);
    const priced = allowed.map((rate) => ({
      price: Money.of(Number(rate.amount.value), rate.amount.currency),
      service: rate.serviceName,
      estimated: false,
    }));
    if (priced.length === 0) throw new ShippingError('no Fastship service available for this parcel');
    return priced.reduce((best, q) => (q.price.isLessThan(best.price) ? q : best));
  }
}
