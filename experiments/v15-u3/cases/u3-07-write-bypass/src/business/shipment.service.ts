import { ShipmentRepository } from '../persistence/shipment.repository';

export class ShipmentService {
  constructor(private readonly repo: ShipmentRepository) {}

  create(orderId: string): string {
    if (orderId === '') throw new Error('a shipment needs an order');
    return this.repo.insert(orderId);
  }
}
