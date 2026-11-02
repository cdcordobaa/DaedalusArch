import type { GeoPoint } from './GeoPoint';

/** The outcome of booking a delivery: scheduled to a verified address, or rejected. */
export type Delivery =
  | {
      readonly orderId: string;
      readonly status: 'scheduled';
      readonly address: string;
      readonly point: GeoPoint;
    }
  | {
      readonly orderId: string;
      readonly status: 'rejected';
      readonly reason: string;
    };
