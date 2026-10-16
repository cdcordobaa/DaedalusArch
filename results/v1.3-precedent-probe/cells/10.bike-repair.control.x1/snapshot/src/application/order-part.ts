import type { PartOrder, WorkOrder } from '../domain/work-order';
import type { PartsCatalogue } from './ports/parts-catalogue';
import type { WorkOrderRepository } from './ports/work-order-repository';

export class OrderPart {
  constructor(
    private readonly orders: WorkOrderRepository,
    private readonly catalogue: PartsCatalogue,
  ) {}

  async execute(workOrderId: string, sku: string, quantity = 1, now = new Date()): Promise<WorkOrder> {
    const order = await this.orders.findById(workOrderId);
    if (order === undefined) throw new Error(`unknown work order ${workOrderId}`);
    if (order.status === 'done') throw new Error(`work order ${workOrderId} is already done`);
    const placed = await this.catalogue.orderPart(sku, quantity, order.id);
    const partOrder: PartOrder = { sku, supplierOrderRef: placed.orderRef, expectedDelivery: placed.expectedDelivery, orderedAt: now };
    order.partOrders = [...(order.partOrders ?? []), partOrder];
    order.status = 'waiting-for-parts';
    await this.orders.save(order);
    return order;
  }
}
