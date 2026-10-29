import type { TracklineClient, TracklineStatus } from 'trackline-sdk';
import type { ParcelStage } from '../../../domain/model/ParcelStage';
import type { Tracking } from '../../../application/ports/out/Tracking';

const STAGES: Record<TracklineStatus, ParcelStage> = { LABEL_CREATED: 'labelCreated', PICKED_UP: 'pickedUp', IN_TRANSIT: 'inTransit', OUT_FOR_DELIVERY: 'outForDelivery', DELIVERED: 'delivered', DELIVERY_FAILED: 'deliveryFailed' };

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async stageOf(trackingCode: string): Promise<ParcelStage> {
    const { events } = await this.client.track(trackingCode);
    return STAGES[events[events.length - 1]!.status];
  }
}
