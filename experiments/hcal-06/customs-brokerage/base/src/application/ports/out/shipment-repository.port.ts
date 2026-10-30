import { Shipment } from '../../../domain/shipment';

export interface ShipmentRepositoryPort {
  findById(id: string): Promise<Shipment | null>;
  save(shipment: Shipment): Promise<void>;
}
