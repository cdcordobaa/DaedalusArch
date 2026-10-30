import { ShipmentRepositoryPort } from '../../../application/ports/out/shipment-repository.port';
import { Shipment } from '../../../domain/shipment';

export class InMemoryShipmentRepository implements ShipmentRepositoryPort {
  private readonly rows = new Map<string, Shipment>();

  async findById(id: string): Promise<Shipment | null> {
    return this.rows.get(id) ?? null;
  }

  async save(shipment: Shipment): Promise<void> {
    this.rows.set(shipment.id, shipment);
  }
}
