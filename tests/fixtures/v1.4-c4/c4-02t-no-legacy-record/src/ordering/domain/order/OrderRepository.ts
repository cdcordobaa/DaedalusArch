import type { Order } from './Order';

export interface OrderRepository {
  save(order: Order): void;
}
