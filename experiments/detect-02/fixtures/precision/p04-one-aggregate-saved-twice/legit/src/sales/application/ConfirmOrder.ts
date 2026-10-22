import type { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';

export class ConfirmOrder {
  constructor(private readonly orders: OrderRepository) {}

  /** Saves the confirmation first (so a crash after it keeps it), then the shipment step, on the same order. */
  async execute(orderId: string): Promise<void> {
    const order = await this.orders.byId(orderId);
    if (order === undefined) throw new Error(`no order ${orderId}`);
    order.confirm();
    await this.orders.save(order);
    order.markShipped();
    await this.persist(order);
  }

  private async persist(o: Order): Promise<void> {
    await this.orders.save(o);
  }
}
