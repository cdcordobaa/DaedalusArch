import type { GeoPoint } from './GeoPoint';

/** A parcel locker where a customer can collect a parcel instead of a home delivery. */
export interface PickupPoint {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly point: GeoPoint;
}
