import { Money } from '../model/Money';
import type { Parcel, WeightBand } from '../model/Parcel';
import type { Quote } from '../model/Quote';

const DOMESTIC: Record<WeightBand, number> = { 'up-to-1kg': 4.9, 'up-to-5kg': 7.9, 'up-to-30kg': 14.9 };
const INTERNATIONAL: Record<WeightBand, number> = { 'up-to-1kg': 12.9, 'up-to-5kg': 21.9, 'up-to-30kg': 44.9 };

/** Our own fixed prices by weight band, domestic or international. */
export class PriceTable {
  quote(parcel: Parcel): Quote {
    const table = parcel.isDomestic() ? DOMESTIC : INTERNATIONAL;
    return { price: Money.of(table[parcel.band()], 'EUR'), service: 'House rate', estimated: true };
  }
}
