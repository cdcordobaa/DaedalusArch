import type { Order } from '../../../domain/model/Order';
import type { Orders } from '../../../application/ports/out/storage/Orders';

export class InMemoryOrders implements Orders {
  private readonly rows = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.rows.set(order.orderId, order);
  }

  async get(orderId: string): Promise<Order | null> {
    return this.rows.get(orderId) ?? null;
  }
}
