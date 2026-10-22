import { Money } from '../../shared-kernel/Money';
import { Order } from '../domain/order/Order';
import type { OrderRepository } from '../domain/order/OrderRepository';
import type { MemberDirectory } from './ports/MemberDirectory';

export class PlaceOrder {
  constructor(private readonly orders: OrderRepository, private readonly members: MemberDirectory) {}

  async execute(memberId: string, totalCents: number): Promise<string> {
    const gold = this.members.tierOf(memberId) === 'gold';
    const order = Order.place(this.orders.nextId(), memberId, Money.of(gold ? Math.round(totalCents * 0.9) : totalCents));
    await this.orders.save(order);
    this.members.award(memberId, Math.floor(totalCents / 100));
    return order.id;
  }
}
