import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address on its label. */
export interface Delivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}
