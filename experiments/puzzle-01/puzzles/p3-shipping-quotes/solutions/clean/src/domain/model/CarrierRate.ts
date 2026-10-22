import type { Money } from './Money';

/** One carrier service offered for a parcel. */
export interface CarrierRate {
  readonly service: string;
  readonly price: Money;
  readonly freight: boolean;
}
