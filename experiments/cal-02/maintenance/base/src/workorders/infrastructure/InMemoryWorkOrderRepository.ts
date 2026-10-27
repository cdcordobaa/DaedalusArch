import { WorkOrder } from '../domain/workorder/WorkOrder';
import { WorkOrderRepository } from '../domain/workorder/WorkOrderRepository';

export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  private readonly items = new Map<string, WorkOrder>();

  save(workOrder: WorkOrder): void {
    this.items.set(workOrder.id, workOrder);
  }

  findById(id: string): WorkOrder | undefined {
    return this.items.get(id);
  }
}
