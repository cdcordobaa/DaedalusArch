import type { MemberRepository } from '../../membership/domain/member/MemberRepository';
import { MemberId } from '../../membership/domain/member/value-objects/MemberId';
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
    private readonly members: MemberRepository,
  ) {}

  execute(memberId: string | null, lines: readonly LineRequest[], currency = 'EUR'): PlacedOrder {
    if (memberId !== null && !this.directory.exists(memberId)) throw new Error(`no member ${memberId}`);
    const member = memberId === null ? undefined : this.members.byId(MemberId.of(memberId));
    const rate = member?.tier() === 'gold' ? 0.1 : member?.tier() === 'silver' ? 0.05 : 0;
    const order = Order.place(this.orders.nextId(), memberId, lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: Money.of(l.unitPrice, currency) })), rate);
    this.orders.save(order);
    const points = Math.floor(order.total().cents / 100);
    if (member !== undefined && points > 0) {
      member.award(points);
      this.members.save(member);
    }
    return { orderId: order.id.value, total: order.total().amount(), discount: order.discount().amount() };
  }
}
