import type { Order } from './order';

export interface OrderRepository {
  save(o: Order): void;
}
