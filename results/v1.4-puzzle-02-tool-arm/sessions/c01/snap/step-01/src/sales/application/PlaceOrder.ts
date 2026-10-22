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

const TIER_DISCOUNTS: Readonly<Record<string, number>> = { gold: 0.1, silver: 0.05, standard: 0 };

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly directory: MemberDirectory,
  ) {}

  execute(memberId: string | null, lines: readonly LineRequest[], currency = 'EUR'): PlacedOrder {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })));
    this.orders.save(order);
    const total = order.total();
    const discount = total.minus(total.times(1 - this.discountRate(memberId)));
    return { orderId: order.id.value, total: total.amount(), discount: discount.amount() };
  }

  private discountRate(memberId: string | null): number {
    if (memberId === null) return 0;
    return TIER_DISCOUNTS[this.directory.tierOf(memberId) ?? ''] ?? 0;
  }
}
