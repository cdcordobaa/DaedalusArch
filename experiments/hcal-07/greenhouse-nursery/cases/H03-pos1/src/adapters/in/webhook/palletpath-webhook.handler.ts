import { RecordDeliveryPort } from '../../../application/ports/in/record-delivery.port';
import { DeliveryOutcome } from '../../../domain/freight';
import { parseCarrierDate } from '../../out/freight/carrier-dates';
import { TrackingEventDto } from './tracking-event.dto';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class PalletPathWebhookHandler {
  constructor(private readonly recordDelivery: RecordDeliveryPort) {}

  async handle(event: TrackingEventDto): Promise<{ accepted: boolean }> {
    if (Date.now() - parseCarrierDate(event.event_time).getTime() > WEEK_MS) return { accepted: false };
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
    return 'in-transit';
  }
}
