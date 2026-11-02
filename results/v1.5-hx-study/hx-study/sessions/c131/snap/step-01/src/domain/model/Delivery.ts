import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address as the geocoder writes it. */
export interface Delivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}
