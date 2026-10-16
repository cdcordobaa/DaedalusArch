import type { Order } from '../../domain/Order.js';
import type { OrderRepository } from '../../domain/OrderRepository.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders: Order[] = [];

  save(order: Order): void {
    this.orders.push(order);
  }
}
