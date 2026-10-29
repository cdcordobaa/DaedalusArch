import type { TracklineClient } from 'trackline-sdk';
import type { Order } from '../../../domain/model/Order';
import type { Couriers } from '../../../application/ports/out/courier/Couriers';

export class TracklineCouriersAdapter implements Couriers {
  constructor(private readonly client: TracklineClient) {}

  async book(order: Order): Promise<string> {
    const shipment = await this.client.createShipment({
      reference: order.orderId,
      recipientName: order.recipient,
      street: order.street,
      postcode: order.postcode,
      city: order.city,
      signature: order.signature === 'adult' ? 'ADULT' : 'NONE',
    });
    return shipment.trackingCode;
  }
}
