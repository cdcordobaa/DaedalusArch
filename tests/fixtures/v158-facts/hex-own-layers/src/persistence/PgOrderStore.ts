import type { Order } from '../domain/Order';
import type { OrderStore } from '../application/ports/OrderStore';

export class PgOrderStore implements OrderStore {
  private readonly rows = new Map<string, Order>();
  async byId(id: string): Promise<Order | undefined> { return this.rows.get(id); }
  async save(order: Order): Promise<void> { this.rows.set(order.id, order); }
}
