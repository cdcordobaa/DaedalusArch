import type { WorkOrderRepository } from '../../application/ports/work-order-repository';
import type { WorkOrder } from '../../domain/work-order';

export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private readonly rows = new Map<string, WorkOrder>();

  async findById(id: string): Promise<WorkOrder | undefined> {
    return this.rows.get(id);
  }

  async findOpen(): Promise<WorkOrder[]> {
    return [...this.rows.values()].filter((o) => o.status !== 'done');
  }

  async save(order: WorkOrder): Promise<void> {
    this.rows.set(order.id, order);
  }
}
