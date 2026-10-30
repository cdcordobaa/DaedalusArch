import type { TracklineClient } from 'trackline-sdk';
import type { TrackingUpdate } from '../../../domain/model/TrackingUpdate';
import type { Tracking } from '../../../application/ports/out/courier/Tracking';

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async latest(trackingCode: string): Promise<TrackingUpdate> {
    const { events } = await this.client.track(trackingCode);
    const e = events[events.length - 1]!;
    return { at: e.at, place: e.location, stageCode: e.status.toLowerCase() };
  }
}
