import type { Order } from './Order';

export interface OrderRepository {
  byId(id: string): Order;
  save(order: Order): void;
}
