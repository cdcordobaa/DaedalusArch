import type { Order } from '../../../../domain/model/Order';

/** Books a courier for a bouquet; answers the tracking code. */
export interface Couriers {
  book(order: Order): Promise<string>;
}
