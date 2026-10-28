import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address as the lookup writes it. */
export interface ScheduledDelivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}

/** A delivery that was not booked because the address could not be found. */
export interface RejectedDelivery {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type Delivery = ScheduledDelivery | RejectedDelivery;
