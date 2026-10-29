import type { TracklineClient, TracklineStatus } from 'trackline-sdk';
import type { TrackingUpdate } from '../../../domain/model/TrackingUpdate';
import type { DeliveryProgress } from '../../../domain/model/DeliveryProgress';
import type { Tracking } from '../../../application/ports/out/courier/Tracking';

const PROGRESS: Record<TracklineStatus, DeliveryProgress> = { LABEL_CREATED: 'preparing', PICKED_UP: 'onItsWay', IN_TRANSIT: 'onItsWay', OUT_FOR_DELIVERY: 'arrivingToday', DELIVERED: 'delivered', DELIVERY_FAILED: 'problem' };

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async latest(trackingCode: string): Promise<TrackingUpdate> {
    const { events } = await this.client.track(trackingCode);
    const e = events[events.length - 1]!;
    return { at: e.at, place: e.location, stageCode: e.status.toLowerCase(), progress: PROGRESS[e.status] };
  }
}
