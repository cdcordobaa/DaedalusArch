import { WorkOrder } from './WorkOrder';

export interface WorkOrderRepository {
  save(workOrder: WorkOrder): void;
  findById(id: string): WorkOrder | undefined;
}
