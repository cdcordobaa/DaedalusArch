import type { FastshipTrackingEvent } from 'fastship-sdk';

export interface TrackingPort {
  events(trackingNumber: string): Promise<FastshipTrackingEvent[]>;
}
