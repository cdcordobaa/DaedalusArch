import type { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import { LineTable } from './LineTable';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();
  private readonly lines = new LineTable();
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
    for (const line of order.lines) this.lines.upsert(order.id, line);
  }
}
