import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { OrderPlaced } from './events/OrderPlaced';
import type { OrderId } from './value-objects/OrderId';

export interface OrderLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: Money;
}

export interface OrderState {
  readonly id: OrderId;
  readonly memberId: string | null;
  readonly lines: readonly OrderLine[];
  readonly discountPercent?: number;
}

/** A placed order. Every line has a positive whole quantity and a non-negative price. */
export class Order {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly memberId: string | null,
    readonly lines: readonly OrderLine[],
    readonly discountPercent: number,
  ) {}

  static place(id: OrderId, memberId: string | null, lines: readonly OrderLine[], discountPercent = 0): Order {
    if (lines.length === 0) throw new Error('an order needs at least one line');
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`line ${line.sku}: quantity must be a positive whole number`);
      if (line.unitPrice.isNegative()) throw new Error(`line ${line.sku}: price must not be negative`);
    }
    const order = new Order(id, memberId, lines, discountPercent);
    order.pending.push(new OrderPlaced(id.value, memberId, order.total().cents, order.total().currency));
    return order;
  }

  static restore(state: OrderState): Order {
    return new Order(state.id, state.memberId, state.lines, state.discountPercent ?? 0);
  }

  /** The price of the lines before any discount. */
  subtotal(): Money {
    const currency = this.lines[0]?.unitPrice.currency ?? 'EUR';
    return this.lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), Money.zero(currency));
  }

  discount(): Money {
    return this.subtotal().times(this.discountPercent / 100);
  }

  /** What the customer pays: the subtotal less the discount. */
  total(): Money {
    return this.subtotal().minus(this.discount());
  }

  /** Loyalty points this order earns: one per whole currency unit paid. Guests earn none. */
  pointsEarned(): number {
    return this.memberId === null ? 0 : Math.max(0, Math.floor(this.total().cents / 100));
  }

  state(): OrderState {
    return { id: this.id, memberId: this.memberId, lines: this.lines, discountPercent: this.discountPercent };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
