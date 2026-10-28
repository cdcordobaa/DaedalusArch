import type { HaemalinkClient, HlConsignment } from 'haemalink-sdk';
import type { Deliveries } from '../../../application/needs/Deliveries';
import type { DeliveryState, DeliveryUpdate } from '../../../domain/DeliveryUpdate';

const STATE: Record<HlConsignment['stage'], DeliveryState> = {
  PICKING: 'being packed',
  DISPATCHED: 'on the way',
  DELIVERED: 'delivered',
};

/** Follows a delivery through Haemalink's consignment record and tells it in our words. */
export class HaemalinkDeliveries implements Deliveries {
  constructor(private readonly client: HaemalinkClient) {}

  async latest(orderNumber: string): Promise<DeliveryUpdate> {
    const consignment = await this.client.consignment(orderNumber);
    return { state: STATE[consignment.stage], at: consignment.stageAt };
  }
}
