import { OrderRepositoryPort } from '../../../application/ports/out/order-repository.port';
import { BookOrder } from '../../../domain/book-order';

export class InMemoryOrderRepository implements OrderRepositoryPort {
  private readonly rows = new Map<string, BookOrder>();

  async findById(id: string): Promise<BookOrder | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProductionRef(productionRef: string): Promise<BookOrder | null> {
    for (const order of this.rows.values()) {
      if (order.productionReference === productionRef) return order;
    }
    return null;
  }

  async save(order: BookOrder): Promise<void> {
    this.rows.set(order.id, order);
  }
}
