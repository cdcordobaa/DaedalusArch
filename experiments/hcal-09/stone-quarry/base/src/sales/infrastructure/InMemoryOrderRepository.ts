import { OrderRepository } from '../domain/order/OrderRepository';
import { QuarryOrder } from '../domain/order/QuarryOrder';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, QuarryOrder>();

  async findById(id: string): Promise<QuarryOrder | null> {
    return this.rows.get(id) ?? null;
  }

  async save(order: QuarryOrder): Promise<void> {
    this.rows.set(order.id, order);
  }
}
