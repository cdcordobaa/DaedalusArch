import type { TracklineClient } from 'trackline-sdk';
import type { TracklineStatus } from 'trackline-sdk';
import type { DeliveryStage, TrackingUpdate } from '../../../domain/model/TrackingUpdate';
import type { Tracking } from '../../../application/ports/out/Tracking';

function stageOf(status: TracklineStatus): DeliveryStage {
  switch (status) {
    case 'LABEL_CREATED':
      return 'preparing';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return 'on its way';
    case 'DELIVERED':
      return 'delivered';
    case 'DELIVERY_FAILED':
      return 'problem';
    default: {
      const unknown: never = status;
      throw new Error('unknown Trackline status ' + String(unknown));
    }
  }
}

export class TracklineTrackingAdapter implements Tracking {
  constructor(private readonly client: TracklineClient) {}

  async latest(trackingCode: string): Promise<TrackingUpdate> {
    const { events } = await this.client.track(trackingCode);
    const e = events[events.length - 1]!;
    return { at: e.at, place: e.location, stageCode: e.status.toLowerCase(), stage: stageOf(e.status) };
  }
}
