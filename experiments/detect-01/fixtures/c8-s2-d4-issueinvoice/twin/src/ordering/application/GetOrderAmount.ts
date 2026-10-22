import type { OrderAmount, OrderAmountQuery } from '../contracts/OrderCommands.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';

/** Query service: reads only. */
export class GetOrderAmount implements OrderAmountQuery {
  constructor(private readonly orders: OrderRepository) {}

  async amountOf(orderId: string): Promise<OrderAmount | null> {
    const order = await this.orders.byId(orderId);
    return order === null ? null : { orderId, amountCents: 0, currency: 'EUR' };
  }
}
