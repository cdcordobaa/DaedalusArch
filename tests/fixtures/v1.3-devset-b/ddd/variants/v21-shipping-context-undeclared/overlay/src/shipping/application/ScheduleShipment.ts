import { Shipment } from '../domain/Shipment.js';

export class ScheduleShipment {
  private readonly scheduled: Shipment[] = [];

  execute(shipmentId: string, orderId: string): Shipment {
    const shipment = new Shipment(shipmentId, orderId);
    this.scheduled.push(shipment);
    return shipment;
  }
}
