import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the verified address and point. */
export interface Delivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point?: GeoPoint;
  /** True when the address was not checked by the geocoder. */
  readonly unverified: boolean;
}
