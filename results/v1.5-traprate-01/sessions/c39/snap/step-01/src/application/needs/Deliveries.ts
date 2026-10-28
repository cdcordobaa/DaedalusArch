import type { DeliveryUpdate } from '../../domain/DeliveryUpdate';

/** The latest state of a delivery the regional supplier is bringing us. */
export interface Deliveries {
  latest(orderNumber: string): Promise<DeliveryUpdate>;
}
