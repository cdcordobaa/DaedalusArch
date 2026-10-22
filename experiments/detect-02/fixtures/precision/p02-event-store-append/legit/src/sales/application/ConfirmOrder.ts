import type { OrderRepository } from '../domain/order/OrderRepository';

export class ConfirmOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderId: string): Promise<void> {
    const order = await this.orders.byId(orderId);
    if (order === undefined) throw new Error(`no order ${orderId}`);
    order.confirm();
    await this.orders.save(order);
  }
}
