import type { Order } from '../domain/order/Order.js';
import type { OrderLine } from '../domain/order/OrderLine.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import type { OrderId } from '../domain/order/value-objects/OrderId.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();
  private readonly lines = new Map<string, OrderLine[]>();

  async byId(id: OrderId): Promise<Order | null> {
    return this.rows.get(id.value) ?? null;
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id.value, order);
  }

  async saveLine(orderId: OrderId, line: OrderLine): Promise<void> {
    const current = this.lines.get(orderId.value) ?? [];
    this.lines.set(orderId.value, [...current, line]);
  }
}
