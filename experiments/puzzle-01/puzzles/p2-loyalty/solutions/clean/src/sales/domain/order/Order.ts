import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/Money';
import { OrderPlaced } from './events/OrderPlaced';
import { discountRateOf, type CustomerTier } from './value-objects/CustomerTier';
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
  readonly tier: CustomerTier;
}

/** A placed order. Every line has a positive whole quantity and a non-negative price. */
export class Order {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly memberId: string | null,
    readonly lines: readonly OrderLine[],
    readonly tier: CustomerTier,
  ) {}

  static place(id: OrderId, memberId: string | null, lines: readonly OrderLine[], tier: CustomerTier = 'standard'): Order {
    if (lines.length === 0) throw new Error('an order needs at least one line');
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`line ${line.sku}: quantity must be a positive whole number`);
      if (line.unitPrice.isNegative()) throw new Error(`line ${line.sku}: price must not be negative`);
    }
    const order = new Order(id, memberId, lines, tier);
    order.pending.push(new OrderPlaced(id.value, memberId, order.total().cents, order.total().currency));
    return order;
  }

  static restore(state: OrderState): Order {
    return new Order(state.id, state.memberId, state.lines, state.tier);
  }

  subtotal(): Money {
    const currency = this.lines[0]?.unitPrice.currency ?? 'EUR';
    return this.lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), Money.zero(currency));
  }

  discount(): Money {
    return this.subtotal().times(discountRateOf(this.tier));
  }

  total(): Money {
    return this.subtotal().minus(this.discount());
  }

  state(): OrderState {
    return { id: this.id, memberId: this.memberId, lines: this.lines, tier: this.tier };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
