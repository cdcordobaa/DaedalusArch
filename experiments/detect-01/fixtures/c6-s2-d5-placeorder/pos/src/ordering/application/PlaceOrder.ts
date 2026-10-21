import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Order } from '../domain/order/Order.js';
import type { OrderRepository } from '../domain/order/OrderRepository.js';
import { Quantity } from '../domain/value-objects/Quantity.js';

export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: string;
  readonly lines: readonly { readonly productId: string; readonly quantity: number; readonly unitPriceCents: number }[];
}

/** Application service: loads, delegates to the aggregate, saves. No business rule lives here. */
export class PlaceOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(cmd: PlaceOrderCommand): Promise<void> {
    const order = new Order(cmd.orderId, cmd.customerId, cmd.currency);
    cmd.lines.forEach((l, i) => {
      const where = `Order line ${i + 1} (product ${l.productId})`;
      if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new Error(`${where}: quantity must be a positive whole number, got ${l.quantity}`);
      if (!Number.isInteger(l.unitPriceCents) || l.unitPriceCents < 0) throw new Error(`${where}: unit price must be a non-negative whole number of cents, got ${l.unitPriceCents}`);
      order.addLine(l.productId, new Quantity(l.quantity), Money.of(l.unitPriceCents, cmd.currency));
    });
    await this.orders.save(order);
  }
}
