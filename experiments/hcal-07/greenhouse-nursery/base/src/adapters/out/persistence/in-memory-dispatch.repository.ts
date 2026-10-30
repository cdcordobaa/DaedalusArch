import { DispatchRepositoryPort } from '../../../application/ports/out/dispatch-repository.port';
import { DispatchOrder } from '../../../domain/dispatch-order';

export class InMemoryDispatchRepository implements DispatchRepositoryPort {
  private readonly rows = new Map<string, DispatchOrder>();

  async findById(id: string): Promise<DispatchOrder | null> {
    return this.rows.get(id) ?? null;
  }

  async findByFreightRef(freightRef: string): Promise<DispatchOrder | null> {
    for (const order of this.rows.values()) {
      if (order.freightReference === freightRef) return order;
    }
    return null;
  }

  async save(order: DispatchOrder): Promise<void> {
    this.rows.set(order.id, order);
  }
}
