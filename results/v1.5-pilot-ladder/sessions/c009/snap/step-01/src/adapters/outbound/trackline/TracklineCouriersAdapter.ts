import type { TracklineClient } from 'trackline-sdk';
import type { Order } from '../../../domain/model/Order';
import type { Couriers, DeliveryStage } from '../../../application/ports/out/Couriers';

export class TracklineCouriersAdapter implements Couriers {
  constructor(private readonly client: TracklineClient) {}

  async book(order: Order): Promise<string> {
    const shipment = await this.client.createShipment({
      reference: order.orderId,
      recipientName: order.recipient,
      street: order.street,
      postcode: order.postcode,
      city: order.city,
      signature: 'NONE',
    });
    return shipment.trackingCode;
  }

  async track(trackingCode: string): Promise<DeliveryStage> {
    const tracking = await this.client.track(trackingCode);
    const latest = tracking.events[tracking.events.length - 1];
    if (latest === undefined) return 'preparing';
    switch (latest.status) {
      case 'LABEL_CREATED':
        return 'preparing';
      case 'PICKED_UP':
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return 'on its way';
      case 'DELIVERED':
        return 'delivered';
      case 'DELIVERY_FAILED':
        return 'problem';
    }
  }
}
