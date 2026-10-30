import { RecordDeliveryPort } from '../../../application/ports/in/record-delivery.port';
import { DeliveryStage } from '../../../domain/delivery-stage';
import { TrackingEventDto } from './tracking-event.dto';

export class PalletPathWebhookHandler {
  constructor(private readonly recordDelivery: RecordDeliveryPort) {}

  async handle(event: TrackingEventDto): Promise<{ accepted: boolean }> {
    await this.recordDelivery.record({
      freightRef: event.consignment_no,
      stage: this.toStage(event.consignment_status),
      signedBy: event.pod_signature,
    });
    return { accepted: true };
  }

  private toStage(status: string): DeliveryStage {
    switch (status) {
      case 'COLLECTED': return 'PICKED_UP';
      case 'AT_HUB': return 'SORTING';
      case 'OUT_FOR_DELIVERY': return 'ON_VAN';
      case 'DELIVERED': return 'HANDED_OVER';
      case 'RETURNED': return 'SENT_BACK';
      default: return 'AWAITING_COLLECTION';
    }
  }
}
