import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the verified address with its delivery point. */
export interface ScheduledDelivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}

/** A delivery that was not scheduled because the address could not be verified. */
export interface RejectedDelivery {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type Delivery = ScheduledDelivery | RejectedDelivery;
