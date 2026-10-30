import { ShipTrackClient, TrackingStatus } from 'shiptrack-sdk';
import { TrackingPort } from '../../../application/ports/out/tracking.port';
import { DeliveryOutcome, ParcelUpdate } from '../../../domain/parcel';

export class ShipTrackTrackingAdapter implements TrackingPort {
  private readonly client: ShipTrackClient;

  constructor(apiKey: string) {
    this.client = new ShipTrackClient({ api_key: apiKey });
  }

  async latest(trackingNumber: string): Promise<ParcelUpdate> {
    const ev = await this.client.latest(trackingNumber);
    return { trackingNumber: ev.tracking_number, outcome: this.toOutcome(ev.status), at: new Date(ev.occurred_at) };
  }

  private toOutcome(s: TrackingStatus): DeliveryOutcome {
    switch (s) {
      case 'LABEL_CREATED':
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return 'pending';
      case 'DELIVERED':
        return 'delivered';
      case 'EXCEPTION':
      case 'RETURNED':
        return 'failed';
    }
  }
}
