import type { TracklineClient, TracklineStatus } from 'trackline-sdk';
import type { DeliveryProgress } from '../../../domain/model/DeliveryProgress';
import type { Tracking } from '../../../application/ports/out/Tracking';

const PROGRESS: Record<TracklineStatus, DeliveryProgress> = { LABEL_CREATED: 'preparing', PICKED_UP: 'onItsWay', IN_TRANSIT: 'onItsWay', OUT_FOR_DELIVERY: 'onItsWay', DELIVERED: 'delivered', DELIVERY_FAILED: 'problem' };

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async progressOf(trackingCode: string): Promise<DeliveryProgress> {
    const { events } = await this.client.track(trackingCode);
    return PROGRESS[events[events.length - 1]!.status];
  }
}
