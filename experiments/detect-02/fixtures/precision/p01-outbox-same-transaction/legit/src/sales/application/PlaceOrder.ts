import { Money } from '../../shared-kernel/Money';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { Outbox } from './ports/Outbox';
import type { TransactionRunner } from './ports/TransactionRunner';

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly outbox: Outbox,
    private readonly tx: TransactionRunner,
  ) {}

  async execute(customerId: string, totalCents: number): Promise<string> {
    const order = Order.place(this.orders.nextId(), customerId, Money.of(totalCents));
    await this.tx.run(async () => {
      await this.orders.save(order);
      await this.outbox.add(order.pullEvents());
    });
    return order.id;
  }
}
