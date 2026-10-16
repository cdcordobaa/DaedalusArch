import type { WorkOrder } from '../domain/work-order';
import type { WorkOrderRepository } from './ports/work-order-repository';

export class CloseWorkOrder {
  constructor(private readonly orders: WorkOrderRepository) {}

  async execute(orderId: string): Promise<WorkOrder> {
    const order = await this.orders.findById(orderId);
    if (order === undefined) throw new Error(`unknown work order ${orderId}`);
    order.status = 'done';
    await this.orders.save(order);
    return order;
  }
}
