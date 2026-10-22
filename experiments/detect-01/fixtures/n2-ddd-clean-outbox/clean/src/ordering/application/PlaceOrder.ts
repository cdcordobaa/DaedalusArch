import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Order } from '../domain/order/Order.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { Quantity } from '../domain/value-objects/Quantity.js';
import type { Outbox } from './ports/Outbox.js';

export class PlaceOrder {
  constructor(private readonly orders: OrderRepository, private readonly outbox: Outbox) {}

  async execute(orderId: string, currency: string, lines: readonly { productId: string; quantity: number; unitPriceCents: number }[]): Promise<void> {
    const order = new Order(orderId, currency);
    for (const l of lines) order.addLine(l.productId, new Quantity(l.quantity), Money.of(l.unitPriceCents, currency));
    order.place(new Date());
    await this.orders.save(order);
    await this.outbox.append(order.pullEvents());
  }
}
