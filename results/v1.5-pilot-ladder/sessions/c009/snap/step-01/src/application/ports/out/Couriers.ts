import type { Order } from '../../../domain/model/Order';

export type DeliveryStage = 'preparing' | 'on its way' | 'delivered' | 'problem';

/** Books a courier for a bouquet; answers the tracking code. */
export interface Couriers {
  book(order: Order): Promise<string>;
  /** Where the bouquet is now, according to the courier's latest step. */
  track(trackingCode: string): Promise<DeliveryStage>;
}
