import { Order } from '../entities/Order';

export interface OrderRepository {
  findById(id: string): Promise<Order | undefined>;
  save(order: Order): Promise<void>;
}
