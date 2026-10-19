import type { Order } from '../../domain/order';
import type { OrderRepository } from '../../domain/order-repository';

export class OrderDb implements OrderRepository {
  save(o: Order): void {
    void o.id;
  }
}
