import type { Order } from './Order.js';

export interface OrderRepository {
  byId(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
