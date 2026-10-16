import type { WorkOrder } from '../domain/work-order';
import type { PartsCatalogue } from './ports/parts-catalogue';
import type { WorkOrderRepository } from './ports/work-order-repository';

export class OrderMissingPart {
  constructor(
    private readonly orders: WorkOrderRepository,
    private readonly supplier: PartsCatalogue,
  ) {}

  async execute(workOrderId: string, sku: string): Promise<WorkOrder> {
    const order = await this.orders.findById(workOrderId);
    if (order === undefined) throw new Error(`unknown work order ${workOrderId}`);
    if (order.status === 'done') throw new Error('cannot order parts for a finished work order');
    const placed = await this.supplier.placeOrder(sku, order.id);
    order.orderedParts = [...(order.orderedParts ?? []), { sku, ...placed }];
    order.status = 'waiting-for-parts';
    await this.orders.save(order);
    return order;
  }
}
