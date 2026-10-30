import { ShipTrackClient, TrackingStatus } from 'shiptrack-sdk';
import { TrackingPort } from '../../../application/ports/out/tracking.port';
import { ParcelStage, ParcelUpdate } from '../../../domain/parcel';

export class ShipTrackTrackingAdapter implements TrackingPort {
  private readonly client: ShipTrackClient;

  constructor(apiKey: string) {
    this.client = new ShipTrackClient({ api_key: apiKey });
  }

  async latest(trackingNumber: string): Promise<ParcelUpdate> {
    const ev = await this.client.latest(trackingNumber);
    return { trackingNumber: ev.tracking_number, stage: this.toStage(ev.status), at: new Date(ev.occurred_at) };
  }

  private toStage(s: TrackingStatus): ParcelStage {
    switch (s) {
      case 'LABEL_CREATED': return 'Created';
      case 'IN_TRANSIT': return 'Moving';
      case 'OUT_FOR_DELIVERY': return 'OutForDelivery';
      case 'DELIVERED': return 'Done';
      case 'EXCEPTION': return 'Problem';
      case 'RETURNED': return 'Back';
    }
  }
}
