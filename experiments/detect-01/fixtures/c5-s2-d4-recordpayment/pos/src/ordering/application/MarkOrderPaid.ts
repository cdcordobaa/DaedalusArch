import type { OrderPaidCommand } from '../contracts/OrderCommands.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

export class MarkOrderPaid implements OrderPaidCommand {
  constructor(private readonly orders: OrderRepository) {}

  async markPaid(orderId: string): Promise<void> {
    const order = await this.orders.byId(orderId);
    if (order === null) throw new Error('Unknown order');
    order.markPaid();
    await this.orders.save(order);
  }
}
