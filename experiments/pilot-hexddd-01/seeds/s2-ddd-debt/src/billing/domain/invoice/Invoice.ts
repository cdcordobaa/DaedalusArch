import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { InvoiceLine } from './InvoiceLine.js';
import { InvoiceId } from './value-objects/InvoiceId.js';
import { InvoiceIssued } from './events/InvoiceIssued.js';

/** Aggregate root of billing. The tax rule lives here, not in the application service. */
export class Invoice {
  private readonly lines: InvoiceLine[] = [];
  private readonly events: DomainEvent[] = [];
  private issued = false;

  constructor(readonly id: InvoiceId, readonly orderId: string, readonly currency: string) {}

  charge(description: string, amount: Money): void {
    if (this.issued) throw new Error('An issued invoice cannot change');
    this.lines.push(new InvoiceLine(this.lines.length + 1, description, amount));
  }

  issue(taxRate: number): void {
    if (this.lines.length === 0) throw new Error('Nothing to invoice');
    const net = this.net();
    this.lines.push(new InvoiceLine(this.lines.length + 1, 'tax', net.times(taxRate)));
    this.issued = true;
    this.events.push(new InvoiceIssued(this.id.value, this.orderId));
  }

  net(): Money {
    return this.lines.filter((l) => l.description !== 'tax').reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }

  total(): Money {
    return this.lines.reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
