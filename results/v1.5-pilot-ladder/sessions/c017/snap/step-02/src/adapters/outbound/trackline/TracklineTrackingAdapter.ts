import type { TracklineClient, TracklineStatus } from 'trackline-sdk';
import type { DeliveryStage, TrackingUpdate } from '../../../domain/model/TrackingUpdate';
import type { Tracking } from '../../../application/ports/out/Tracking';

const STAGES: Record<TracklineStatus, DeliveryStage> = {
  LABEL_CREATED: 'preparing',
  PICKED_UP: 'on its way',
  IN_TRANSIT: 'on its way',
  OUT_FOR_DELIVERY: 'on its way',
  DELIVERED: 'delivered',
  DELIVERY_FAILED: 'problem',
};

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async latest(trackingCode: string): Promise<TrackingUpdate> {
    const { events } = await this.client.track(trackingCode);
    const e = events[events.length - 1]!;
    return { at: e.at, place: e.location, stageCode: e.status.toLowerCase(), stage: STAGES[e.status] };
  }
}
