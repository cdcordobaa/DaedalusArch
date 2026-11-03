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
    if (fulfilment === 'HANDED') return 'delivered';
    else if (fulfilment === 'VOIDED') return 'cancelled';
    else if (fulfilment === 'FREIGHTED' || fulfilment === 'CRATED') return 'in-transit';
    return 'preparing';
  }
}
