// Typings of the Trackline courier SDK (trackline-sdk 5.0), as shipped by the vendor.
declare module 'trackline-sdk' {
  export type TracklineStatus = 'LABEL_CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'DELIVERY_FAILED';
  export type TracklineSignature = 'NONE' | 'ADULT';
  export interface TracklineShipmentRequest {
    reference: string;
    recipientName: string;
    street: string;
    postcode: string;
    city: string;
    signature: TracklineSignature;
  }
  export interface TracklineShipment {
    trackingCode: string;
    labelUrl: string;
  }
  export interface TracklineEvent {
    status: TracklineStatus;
    at: string;
    location: string;
  }
  export interface TracklineTracking {
    trackingCode: string;
    /** Oldest first; the last event is the current one. */
    events: TracklineEvent[];
  }
  export class TracklineError extends Error {}
  export class TracklineClient {
    constructor(options: { apiKey: string });
    createShipment(request: TracklineShipmentRequest): Promise<TracklineShipment>;
    track(trackingCode: string): Promise<TracklineTracking>;
  }
}
