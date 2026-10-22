import { ShippingError } from '../errors/ShippingError';

export type WeightBand = 'up-to-1kg' | 'up-to-5kg' | 'up-to-30kg';

/** A parcel to ship: two-letter country codes and a weight in grams, at most 30 kg. */
export class Parcel {
  private constructor(
    readonly from: string,
    readonly to: string,
    readonly weightGrams: number,
  ) {}

  static of(from: string, to: string, weightGrams: number): Parcel {
    if (!/^[A-Z]{2}$/.test(from) || !/^[A-Z]{2}$/.test(to)) throw new ShippingError('countries are two-letter codes');
    if (!Number.isInteger(weightGrams) || weightGrams <= 0 || weightGrams > 30000) throw new ShippingError('weight must be 1 g to 30 kg');
    return new Parcel(from, to, weightGrams);
  }

  isDomestic(): boolean {
    return this.from === this.to;
  }

  /** Parcels over 20 kg travel by freight only; lighter ones never do. */
  requiresFreight(): boolean {
    return this.weightGrams > 20000;
  }

  band(): WeightBand {
    if (this.weightGrams <= 1000) return 'up-to-1kg';
    if (this.weightGrams <= 5000) return 'up-to-5kg';
    return 'up-to-30kg';
  }
}
