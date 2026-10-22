import type { CustomerRef } from '../../shared-kernel/CustomerRef';
import { Money } from '../../shared-kernel/Money';
import { Order } from '../domain/order/Order';
import type { OrderQueries } from '../domain/order/OrderQueries';
import type { OrderRepository } from '../domain/order/OrderRepository';

export class PlaceOrder {
  constructor(private readonly orders: OrderRepository, private readonly queries: OrderQueries) {}

  async execute(customer: CustomerRef, totalCents: number): Promise<string> {
    const open = await this.queries.openFor(customer);
    if (open.some((o) => o.total.cents === totalCents)) throw new Error('a matching open order already exists');
    const order = Order.place(this.orders.nextId(), customer.id, Money.of(totalCents));
    await this.orders.save(order);
    return order.id;
  }
}
