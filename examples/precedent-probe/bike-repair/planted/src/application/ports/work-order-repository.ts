import type { WorkOrder } from '../../domain/work-order';

export interface WorkOrderRepository {
  findById(id: string): Promise<WorkOrder | undefined>;
  findOpen(): Promise<WorkOrder[]>;
  save(order: WorkOrder): Promise<void>;
}
