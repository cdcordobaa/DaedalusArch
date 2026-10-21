import { Money } from '../../shared-kernel/Money';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { MemberDirectory } from './ports/MemberDirectory';

export interface LineRequest {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface PlacedOrder {
  readonly orderId: string;
  readonly total: number;
  readonly discount: number;
}

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly directory: MemberDirectory,
  ) {}

  execute(memberId: string | null, lines: readonly LineRequest[], currency = 'EUR'): PlacedOrder {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const discountPercent = memberId === null ? 0 : this.directory.discountPercent(memberId);
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), discountPercent);
    // One point per whole currency unit paid. The award goes first: it is the only step that can
    // still fail here, so a failure leaves neither an order nor points behind.
    const points = Math.floor(order.total().cents / 100);
    if (memberId !== null && points > 0) this.directory.awardPoints(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
