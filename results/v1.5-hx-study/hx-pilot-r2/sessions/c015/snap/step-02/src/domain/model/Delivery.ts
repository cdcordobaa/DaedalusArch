import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address as the geocoder writes it, at a point a driver can reach. */
export interface ScheduledDelivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}

/** A delivery that was not booked because the address could not be found precisely enough. */
export interface RejectedDelivery {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type Delivery = ScheduledDelivery | RejectedDelivery;
