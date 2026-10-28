import type { DeliveryUpdate } from '../domain/DeliveryUpdate';
import type { Deliveries } from './needs/Deliveries';

/** The blood bank desk follows a supplier delivery by its order number. */
export class FollowDelivery {
  constructor(private readonly deliveries: Deliveries) {}

  async latest(orderNumber: string): Promise<DeliveryUpdate> {
    if (orderNumber.trim() === '') throw new Error('an order number is needed to follow a delivery');
    return this.deliveries.latest(orderNumber.trim());
  }
}
