import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();
  private sequence = 0;

  nextId(): string {
    this.sequence += 1;
    return `O-${this.sequence}`;
  }

  async byId(id: string): Promise<Order | undefined> {
    return this.rows.get(id);
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, order);
  }
}
