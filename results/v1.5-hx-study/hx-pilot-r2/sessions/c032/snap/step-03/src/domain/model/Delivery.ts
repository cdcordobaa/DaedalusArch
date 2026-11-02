import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to a verified address. */
export interface Delivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  /** Absent when the address could not be verified. */
  readonly point?: GeoPoint;
}
