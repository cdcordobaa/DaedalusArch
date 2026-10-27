import type { GeoPoint } from './GeoPoint';

/** A delivery booked for an order, to the address on its label, or refused with a reason for the customer. */
export type Delivery =
  | {
    readonly orderId: string;
    readonly status: 'scheduled';
    readonly address: string;
    /** Where the driver goes; absent when the address could not be checked. */
    readonly point?: GeoPoint;
    readonly unverified: boolean;
  }
  | { readonly orderId: string; readonly status: 'rejected'; readonly reason: string };
