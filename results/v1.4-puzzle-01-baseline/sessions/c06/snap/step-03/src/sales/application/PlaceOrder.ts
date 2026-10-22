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

const DISCOUNT_PERCENT: Readonly<Record<string, number>> = { gold: 10, silver: 5 };

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly directory: MemberDirectory,
  ) {}

  execute(memberId: string | null, lines: readonly LineRequest[], currency = 'EUR'): PlacedOrder {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const tier = memberId === null ? undefined : this.directory.tierOf(memberId);
    const percent = (tier !== undefined && DISCOUNT_PERCENT[tier]) || 0;
    const order = Order.place(
      this.orders.nextId(),
      memberId,
      lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })),
      percent,
    );
    // Order.place has validated everything, so the award is the only step left that can fail;
    // do it first so a failure leaves no order behind without its points.
    const points = order.pointsEarned();
    if (memberId !== null && points > 0) this.directory.awardPoints(memberId, points);
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
