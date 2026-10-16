import type { Order } from '../entities/Order';

export interface OrderRepository {
  findById(id: string): Order | undefined;
}
