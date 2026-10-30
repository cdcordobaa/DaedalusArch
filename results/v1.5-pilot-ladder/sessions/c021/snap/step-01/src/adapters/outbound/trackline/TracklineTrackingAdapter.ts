import type { TracklineClient, TracklineStatus } from 'trackline-sdk';
import type { DeliveryProgress, TrackingUpdate } from '../../../domain/model/TrackingUpdate';
import type { Tracking } from '../../../application/ports/out/courier/Tracking';

const PROGRESS: Record<TracklineStatus, DeliveryProgress> = {
  LABEL_CREATED: 'PREPARING',
  PICKED_UP: 'ON_ITS_WAY',
  IN_TRANSIT: 'ON_ITS_WAY',
  OUT_FOR_DELIVERY: 'ON_ITS_WAY',
  DELIVERED: 'DELIVERED',
  DELIVERY_FAILED: 'PROBLEM',
};

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async latest(trackingCode: string): Promise<TrackingUpdate> {
    const { events } = await this.client.track(trackingCode);
    const e = events[events.length - 1]!;
    return { at: e.at, place: e.location, stageCode: e.status.toLowerCase(), progress: PROGRESS[e.status] };
  }
}
