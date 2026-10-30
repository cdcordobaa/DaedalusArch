import type { Order } from '../../../domain/model/Order';

/** Where a booked bouquet is, as far as the customer needs to know. */
export type DeliveryStage = 'preparing' | 'on its way' | 'delivered' | 'problem';

/** Books a courier for a bouquet and follows it on its way. */
export interface Couriers {
  /** Answers the tracking code. */
  book(order: Order): Promise<string>;
  /** Answers the stage given by the latest step the courier reports. */
  track(trackingCode: string): Promise<DeliveryStage>;
}
