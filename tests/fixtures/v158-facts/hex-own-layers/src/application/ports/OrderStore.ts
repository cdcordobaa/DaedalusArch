import type { Order } from '../../domain/Order';

export interface OrderStore {
  byId(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<void>;
}
