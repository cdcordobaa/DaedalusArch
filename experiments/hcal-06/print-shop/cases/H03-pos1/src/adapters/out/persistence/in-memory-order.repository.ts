import { OrderRepositoryPort } from '../../../application/ports/out/order-repository.port';
import { BookOrder } from '../../../domain/book-order';
import type { PrintHubJobRef } from '../printing/printhub-production.gateway';

export class InMemoryOrderRepository implements OrderRepositoryPort {
  private readonly rows = new Map<string, BookOrder>();
  private readonly byJob = new Map<PrintHubJobRef, string>();

  async findById(id: string): Promise<BookOrder | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProductionRef(productionRef: string): Promise<BookOrder | null> {
    const id = this.byJob.get(productionRef);
    return id === undefined ? null : (this.rows.get(id) ?? null);
  }

  async save(order: BookOrder): Promise<void> {
    this.rows.set(order.id, order);
    if (order.productionReference !== null) this.byJob.set(order.productionReference, order.id);
  }
}
