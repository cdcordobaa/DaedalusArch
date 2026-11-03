import { RecordDeliveryPort } from '../../../application/ports/in/record-delivery.port';
import { ConsignmentDto } from './consignment.dto';

export class BowcraftConsignmentHandler {
  constructor(private readonly recordDelivery: RecordDeliveryPort) {}

  async handle(event: ConsignmentDto): Promise<{ accepted: boolean }> {
    await this.recordDelivery.record({ supplyRef: event.order_ref, fulfilment: event.fulfilment });
    return { accepted: true };
  }
}
