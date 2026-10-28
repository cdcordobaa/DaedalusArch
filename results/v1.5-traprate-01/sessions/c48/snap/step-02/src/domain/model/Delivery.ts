import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address as the geocoder writes it. */
export interface ScheduledDelivery {
  readonly orderId: string;
  readonly status: 'scheduled';
  readonly address: string;
  /** Absent when the address could not be verified. */
  readonly point?: GeoPoint;
  /** True when the address was not checked by the geocoder. */
  readonly unverified: boolean;
}

/** An order whose address could not be located precisely enough; nothing is scheduled. */
export interface RejectedDelivery {
  readonly orderId: string;
  readonly status: 'rejected';
  readonly reason: string;
}

export type Delivery = ScheduledDelivery | RejectedDelivery;
