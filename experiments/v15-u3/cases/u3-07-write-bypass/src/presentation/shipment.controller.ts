import { ShipmentService } from '../business/shipment.service';
import { ShipmentRepository } from '../persistence/shipment.repository';

export class ShipmentController {
  constructor(
    private readonly shipments: ShipmentService,
    private readonly repo: ShipmentRepository,
  ) {}

  create(orderId: string): string {
    return this.shipments.create(orderId);
  }

  registerReturn(shipmentId: string): void {
    this.repo.markReturned(shipmentId);
  }
}
