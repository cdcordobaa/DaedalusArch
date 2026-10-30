declare module 'shiptrack-sdk' {
  /** Tracking status of a ShipTrack consignment, as the carrier network reports it. */
  export type TrackingStatus =
    /** A label was printed; no carrier scan yet. */
    | 'LABEL_CREATED'
    /** Scanned at a ShipTrack hub or on a line-haul truck. */
    | 'IN_TRANSIT'
    /** On the courier's van for today's round. */
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    /** A carrier exception (address problem, damage, customs hold); see exception_code. */
    | 'EXCEPTION'
    /** Sent back to the sender's depot. */
    | 'RETURNED';

  export interface TrackingEvent {
    tracking_number: string;
    status: TrackingStatus;
    exception_code?: string;
    occurred_at: string;
  }

  export class ShipTrackClient {
    constructor(options: { api_key: string });
    latest(trackingNumber: string): Promise<TrackingEvent>;
  }
}
