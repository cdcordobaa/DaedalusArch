import { OrderLine } from '../domain/order/OrderLine';
import type { OrderRepository } from '../domain/order/OrderRepository';

export class AddLine {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderId: string, lineId: string, sku: string, quantity: number): Promise<void> {
    const order = await this.orders.byId(orderId);
    if (order === undefined) throw new Error(`no order ${orderId}`);
    order.addLine(new OrderLine(lineId, sku, quantity));
    await this.orders.save(order);
  }
}
