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

const TIER_DISCOUNT_PERCENT: Readonly<Record<string, number>> = { gold: 10, silver: 5, standard: 0 };

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly directory: MemberDirectory,
  ) {}

  execute(memberId: string | null, lines: readonly LineRequest[], currency = 'EUR'): PlacedOrder {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), this.discountPercentFor(memberId));
    this.orders.save(order);
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }

  private discountPercentFor(memberId: string | null): number {
    if (memberId === null) return 0;
    const tier = this.directory.tier(memberId);
    return tier === undefined ? 0 : (TIER_DISCOUNT_PERCENT[tier] ?? 0);
  }
}
