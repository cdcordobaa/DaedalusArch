import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import type { OrderSummary } from '../../contracts/OrderSummary.js';
import { Quantity } from '../value-objects/Quantity.js';
import type { CustomerId } from '../customer/value-objects/CustomerId.js';
import { OrderLine } from './OrderLine.js';
import { OrderId } from './value-objects/OrderId.js';
import { OrderPlaced } from './events/OrderPlaced.js';

/** Aggregate root. Lines are created and changed only through Order, which guards the invariants. */
export class Order {
  private readonly lines: OrderLine[] = [];
  private placed = false;
  private readonly events: DomainEvent[] = [];

  constructor(readonly id: OrderId, readonly customerId: CustomerId, readonly currency: string) {}

  addLine(productId: string, quantity: Quantity, unitPrice: Money): void {
    if (this.placed) throw new Error('A placed order cannot change');
    if (unitPrice.currency !== this.currency) throw new Error('Currency mismatch');
    const existing = this.lines.find((l) => l.isFor(productId));
    if (existing) existing.increase(quantity);
    else this.lines.push(new OrderLine(this.lines.length + 1, productId, quantity, unitPrice));
  }

  place(): void {
    if (this.lines.length === 0) throw new Error('An order needs at least one line');
    this.placed = true;
    this.events.push(new OrderPlaced(this.id.value, this.total().cents));
  }

  total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.subtotal()), Money.of(0, this.currency));
  }

  lineCount(): number {
    return this.lines.length;
  }

  toSummary(): OrderSummary {
    const total = this.total();
    return { orderId: this.id.value, customerId: this.customerId.value, totalCents: total.cents, currency: total.currency, lineCount: this.lines.length };
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
