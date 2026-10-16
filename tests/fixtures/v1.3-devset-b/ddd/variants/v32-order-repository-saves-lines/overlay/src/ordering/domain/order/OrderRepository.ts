import type { Order } from './Order.js';
import type { OrderLine } from './OrderLine.js';
import type { OrderId } from './value-objects/OrderId.js';

/** Repository for the Order aggregate root. */
export interface OrderRepository {
  byId(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
  saveLine(orderId: OrderId, line: OrderLine): Promise<void>;
}
