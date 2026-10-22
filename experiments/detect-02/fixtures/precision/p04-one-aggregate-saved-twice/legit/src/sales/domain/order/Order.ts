import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { OrderPlaced } from './events/OrderPlaced';

export type OrderStatus = 'placed' | 'confirmed' | 'shipped' | 'cancelled';

/** A placed order. Its total never changes after placement. */
export class Order {
  private pending: DomainEvent[] = [];

  private constructor(readonly id: string, readonly customerId: string, readonly total: Money, private status: OrderStatus) {}

  static place(id: string, customerId: string, total: Money): Order {
    const o = new Order(id, customerId, total, 'placed');
    o.pending.push(new OrderPlaced(id, customerId, total.cents));
    return o;
  }

  static restore(id: string, customerId: string, total: Money, status: OrderStatus): Order {
    return new Order(id, customerId, total, status);
  }

  confirm(): void {
    if (this.status !== 'placed') throw new Error('only a placed order can be confirmed');
    this.status = 'confirmed';
  }

  markShipped(): void {
    if (this.status !== 'confirmed') throw new Error('only a confirmed order can ship');
    this.status = 'shipped';
  }

  cancel(): void {
    this.status = 'cancelled';
  }

  get state(): OrderStatus {
    return this.status;
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
