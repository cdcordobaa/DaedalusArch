import type { Order } from '../domain/order';
import type { OrderRepository } from '../domain/order-repository';

export class InMemoryOrderRepository implements OrderRepository {
  readonly saved: Order[] = [];

  save(order: Order): void {
    this.saved.push(order);
  }
}
