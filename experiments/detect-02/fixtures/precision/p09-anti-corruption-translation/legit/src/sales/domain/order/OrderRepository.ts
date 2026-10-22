import type { Order } from './Order';

export interface OrderRepository {
  nextId(): string;
  byId(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<void>;
}
