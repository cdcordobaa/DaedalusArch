import { Money } from '../../../shared-kernel/value-objects/Money.js';
import { InvoiceLine } from './InvoiceLine.js';
import { InvoiceId } from './value-objects/InvoiceId.js';

/** Aggregate root of billing. The tax rule lives here, not in the application service. */
export class Invoice {
  private readonly lines: InvoiceLine[] = [];
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
  }

  net(): Money {
    return this.lines.filter((l) => l.description !== 'tax').reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }

  total(): Money {
    return this.lines.reduce((s, l) => s.add(l.amount), Money.of(0, this.currency));
  }
}
