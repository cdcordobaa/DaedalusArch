import type { FastshipClient, FastshipTrackingEvent } from 'fastship-sdk';
import type { TrackingPort } from '../../../application/ports/out/TrackingPort';

export class FastshipTrackingAdapter implements TrackingPort {
  constructor(private readonly client: FastshipClient) {}

  events(trackingNumber: string): Promise<FastshipTrackingEvent[]> {
    return this.client.tracking(trackingNumber);
  }
}
