import { ShippingError } from '../errors/ShippingError';
import type { CarrierRate } from '../model/CarrierRate';
import { Money } from '../model/Money';
import type { Parcel } from '../model/Parcel';
import type { Quote } from '../model/Quote';

const HANDLING_FEE = 1.5;

/** The cheapest suitable carrier service plus our handling fee; heavy parcels go by freight and only by freight. */
export class QuotePolicy {
  best(parcel: Parcel, rates: readonly CarrierRate[]): Quote {
    const suitable = rates.filter((r) => r.freight === parcel.isHeavy());
    const cheapest = suitable.reduce<CarrierRate | undefined>((best, r) => (best === undefined || r.price.isLessThan(best.price) ? r : best), undefined);
    if (cheapest === undefined) throw new ShippingError('no carrier service for this parcel');
    return { price: cheapest.price.plus(Money.of(HANDLING_FEE, cheapest.price.currency)), service: cheapest.service, estimated: false };
  }
}
