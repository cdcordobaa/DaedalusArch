import type { Order } from '../../../domain/model/Order';

export interface Orders {
  save(order: Order): Promise<void>;
  get(orderId: string): Promise<Order | null>;
}
