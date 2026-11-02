import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the verified address of its delivery point. */
export interface ScheduledDelivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  readonly point: GeoPoint;
}

/** A delivery that could not be scheduled because the address could not be located precisely. */
export interface RejectedDelivery {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type Delivery = ScheduledDelivery | RejectedDelivery;
