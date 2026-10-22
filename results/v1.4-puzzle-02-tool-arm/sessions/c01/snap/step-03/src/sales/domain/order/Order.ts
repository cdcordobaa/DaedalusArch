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
}

/** A placed order. Every line has a positive whole quantity and a non-negative price. */
export class Order {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly memberId: string | null,
    readonly lines: readonly OrderLine[],
  ) {}

  static place(id: OrderId, memberId: string | null, lines: readonly OrderLine[], discountRate = 0): Order {
    if (lines.length === 0) throw new Error('an order needs at least one line');
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`line ${line.sku}: quantity must be a positive whole number`);
      if (line.unitPrice.isNegative()) throw new Error(`line ${line.sku}: price must not be negative`);
    }
    const order = new Order(id, memberId, lines);
    const total = order.total();
    const paid = total.times(1 - discountRate);
    order.pending.push(new OrderPlaced(id.value, memberId, total.cents, total.currency, paid.cents));
    return order;
  }

  static restore(state: OrderState): Order {
    return new Order(state.id, state.memberId, state.lines);
  }

  total(): Money {
    const currency = this.lines[0]?.unitPrice.currency ?? 'EUR';
    return this.lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), Money.zero(currency));
  }

  state(): OrderState {
    return { id: this.id, memberId: this.memberId, lines: this.lines };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
