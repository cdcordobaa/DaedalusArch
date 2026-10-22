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
  readonly discount: Money;
}

/** A placed order. Every line has a positive whole quantity and a non-negative price. */
export class Order {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly memberId: string | null,
    readonly lines: readonly OrderLine[],
    readonly discount: Money,
  ) {}

  static place(id: OrderId, memberId: string | null, lines: readonly OrderLine[], discount?: Money): Order {
    if (lines.length === 0) throw new Error('an order needs at least one line');
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`line ${line.sku}: quantity must be a positive whole number`);
      if (line.unitPrice.isNegative()) throw new Error(`line ${line.sku}: price must not be negative`);
    }
    const order = new Order(id, memberId, lines, discount ?? Money.zero(lines[0]?.unitPrice.currency ?? 'EUR'));
    if (order.discount.isNegative() || order.discount.cents > order.total().cents) throw new Error('discount must be between zero and the total');
    order.pending.push(new OrderPlaced(id.value, memberId, order.total().cents, order.total().currency, order.paid().cents));
    return order;
  }

  static restore(state: OrderState): Order {
    return new Order(state.id, state.memberId, state.lines, state.discount);
  }

  total(): Money {
    const currency = this.lines[0]?.unitPrice.currency ?? 'EUR';
    return this.lines.reduce((sum, l) => sum.plus(l.unitPrice.times(l.quantity)), Money.zero(currency));
  }

  /** What the customer pays: the total after the discount. */
  paid(): Money {
    return this.total().minus(this.discount);
  }

  state(): OrderState {
    return { id: this.id, memberId: this.memberId, lines: this.lines, discount: this.discount };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
