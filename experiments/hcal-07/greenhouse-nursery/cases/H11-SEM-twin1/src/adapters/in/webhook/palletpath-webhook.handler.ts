import { RecordDeliveryPort } from '../../../application/ports/in/record-delivery.port';
import { DeliveryOutcome } from '../../../domain/freight';
import { TrackingEventDto } from './tracking-event.dto';

export class PalletPathWebhookHandler {
  constructor(private readonly recordDelivery: RecordDeliveryPort) {}

  async handle(event: TrackingEventDto): Promise<{ accepted: boolean }> {
    await this.recordDelivery.record({
      freightRef: event.consignment_no,
      outcome: this.toOutcome(event.consignment_status),
      signedBy: event.pod_signature,
    });
    return { accepted: true };
  }

  private toOutcome(status: string): DeliveryOutcome {
    if (status === 'DELIVERED') return 'received';
    if (status === 'RETURNED') return 'returned';
    if (status === 'BOOKED') return 'awaiting';
    return 'in-transit';
  }
}
