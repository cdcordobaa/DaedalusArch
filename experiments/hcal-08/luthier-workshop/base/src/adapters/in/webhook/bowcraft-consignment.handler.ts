import { RecordDeliveryPort } from '../../../application/ports/in/record-delivery.port';
import { DeliveryStage } from '../../../domain/supply';
import { ConsignmentDto } from './consignment.dto';

export class BowcraftConsignmentHandler {
  constructor(private readonly recordDelivery: RecordDeliveryPort) {}

  async handle(event: ConsignmentDto): Promise<{ accepted: boolean }> {
    await this.recordDelivery.record({ supplyRef: event.order_ref, stage: this.toStage(event.fulfilment) });
    return { accepted: true };
  }

  private toStage(fulfilment: string): DeliveryStage {
    switch (fulfilment) {
      case 'HANDED':
        return 'delivered';
      case 'VOIDED':
        return 'cancelled';
      case 'FREIGHTED':
        return 'in-transit';
      default:
        return 'preparing';
    }
  }
}
