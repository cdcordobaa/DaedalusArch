import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { Quantity } from '../value-objects/Quantity.js';

export class OrderPlaced implements DomainEvent {
  readonly name = 'ordering.order-placed';
  constructor(readonly orderId: string, readonly totalCents: number, readonly occurredOn: Date) {}
}

/** Aggregate root of the ordering context. */
export class Order {
  private readonly lines: { productId: string; quantity: Quantity; unitPrice: Money }[] = [];
  private readonly events: DomainEvent[] = [];
  private placed = false;

  constructor(readonly id: string, readonly currency: string) {}

  addLine(productId: string, quantity: Quantity, unitPrice: Money): void {
    if (this.placed) throw new Error('A placed order cannot change');
    this.lines.push({ productId, quantity, unitPrice });
  }

  place(on: Date): void {
    if (this.lines.length === 0) throw new Error('An order needs at least one line');
    this.placed = true;
    this.events.push(new OrderPlaced(this.id, this.totalCents(), on));
  }

  totalCents(): number {
    return this.lines.reduce((s, l) => s + l.unitPrice.cents * l.quantity.value, 0);
  }

  lineCount(): number {
    return this.lines.length;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
