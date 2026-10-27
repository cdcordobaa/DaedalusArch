import { InMemoryInvoiceRepository } from '../../infrastructure/InMemoryInvoiceRepository';
import { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/value-objects/Money';
import { InvoiceCancelledEvent } from '../../contracts/InvoiceContracts';

export interface InvoiceLine {
  readonly description: string;
  readonly amount: Money;
}

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

const MAX_LINES = 20;

export class Invoice {
  private readonly lines: InvoiceLine[] = [];
  private status: InvoiceStatus = 'draft';
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly workOrderId: string,
    readonly propertyId: string,
  ) {}

  static draft(id: string, workOrderId: string, propertyId: string): Invoice {
    if (!id.trim() || !workOrderId.trim()) throw new Error('ids required');
    return new Invoice(id, workOrderId, propertyId);
  }

  addLine(line: InvoiceLine): void {
    if (this.status !== 'draft') throw new Error('invoice not editable');
    if (this.lines.length >= MAX_LINES) throw new Error('too many lines');
    this.lines.push(line);
  }

  issue(): void {
    if (this.status !== 'draft') throw new Error('invoice not draft');
    if (this.lines.length === 0) throw new Error('invoice has no lines');
    this.status = 'issued';
  }

  markPaid(): void {
    if (this.status !== 'issued') throw new Error('invoice not issued');
    this.status = 'paid';
  }

  cancel(): void {
    if (this.status === 'paid') throw new Error('invoice already paid');
    if (this.status === 'cancelled') return;
    this.status = 'cancelled';
    const event: InvoiceCancelledEvent = {
      name: 'InvoiceCancelled',
      occurredAt: new Date(),
      invoiceId: this.id,
      workOrderId: this.workOrderId,
    };
    this.events.push(event);
  }

  total(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.amount), Money.of(0));
  }

  currentStatus(): string {
    return this.status;
  }

  lineItems(): readonly InvoiceLine[] {
    return this.lines;
  }

  pullEvents(): DomainEvent[] {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }

  static nextId(repo: InMemoryInvoiceRepository): string {
    return 'INV-' + (repo.count() + 1);
  }
}
