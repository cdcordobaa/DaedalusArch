import type { OrderInvoicedCommand } from '../contracts/OrderCommands.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

export class MarkOrderInvoiced implements OrderInvoicedCommand {
  constructor(private readonly orders: OrderRepository) {}

  async markInvoiced(orderId: string): Promise<void> {
    const order = await this.orders.byId(orderId);
    if (order === null) throw new Error('Unknown order');
    order.markInvoiced();
    await this.orders.save(order);
  }
}
