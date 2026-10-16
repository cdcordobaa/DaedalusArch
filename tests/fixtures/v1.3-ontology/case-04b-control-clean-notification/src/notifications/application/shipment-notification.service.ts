import type { Shipment } from '../../shipping/domain/shipment';
import type { Mailer } from './mailer';

export class ShipmentNotificationService {
  constructor(private readonly mailer: Mailer) {}

  async sendShipped(shipment: Shipment): Promise<void> {
    const day = shipment.shippedAt.toISOString().slice(0, 10);
    await this.mailer.send(shipment.recipientEmail, 'Your order has shipped', `Shipped on ${day} with ${shipment.carrier}.`);
  }
}
