import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Order } from '../domain/order/Order.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { OrderId } from '../domain/order/value-objects/OrderId.js';
import type { CustomerRepository } from '../domain/customer/CustomerRepository.js';
import { CustomerId } from '../domain/customer/value-objects/CustomerId.js';
import { Quantity } from '../domain/value-objects/Quantity.js';

export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: string;
  readonly lines: readonly { productId: string; quantity: number; unitPriceCents: number }[];
}

/** Application service: loads, delegates to the aggregate, saves. No business rule lives here. */
export class PlaceOrder {
  constructor(private readonly orders: OrderRepository, private readonly customers: CustomerRepository) {}

  async execute(cmd: PlaceOrderCommand): Promise<void> {
    const customer = await this.customers.byId(new CustomerId(cmd.customerId));
    if (customer === null || !customer.canOrder()) throw new Error('Unknown or inactive customer');
    const order = new Order(new OrderId(cmd.orderId), customer.id, cmd.currency);
    for (const l of cmd.lines) order.addLine(l.productId, new Quantity(l.quantity), Money.of(l.unitPriceCents, cmd.currency));
    order.place();
    await this.orders.save(order);
  }
}
