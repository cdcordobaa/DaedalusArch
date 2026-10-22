import type { Order } from './Order';
import type { OrderId } from './value-objects/OrderId';

export interface OrderRepository {
  nextId(): OrderId;
  byId(id: OrderId): Order | undefined;
  /** Stores the order and its pending events in one step. */
  save(order: Order): void;
}
