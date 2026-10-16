import { randomUUID } from 'node:crypto';
import type { WorkOrder } from '../domain/work-order';
import type { WorkOrderRepository } from './ports/work-order-repository';

export class OpenWorkOrder {
  constructor(private readonly orders: WorkOrderRepository) {}

  async execute(customerName: string, bike: string, problem: string, now = new Date()): Promise<WorkOrder> {
    const order: WorkOrder = { id: randomUUID(), customerName, bike, problem, openedAt: now, status: 'open' };
    await this.orders.save(order);
    return order;
  }
}
