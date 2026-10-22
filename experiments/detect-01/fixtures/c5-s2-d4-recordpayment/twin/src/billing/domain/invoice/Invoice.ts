import type { DomainEvent } from '../../../shared-kernel/DomainEvent.js';
import { Money } from '../../../shared-kernel/value-objects/Money.js';

export class InvoicePaid implements DomainEvent {
  readonly name = 'billing.invoice-paid';
  constructor(readonly invoiceId: string, readonly orderId: string, readonly occurredOn: Date) {}
}

export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice-issued';
  constructor(readonly invoiceId: string, readonly orderId: string, readonly occurredOn: Date) {}
}

/** Aggregate root of the billing context. */
export class Invoice {
  private issued = false;
  private paidCents = 0;
  private readonly events: DomainEvent[] = [];

  constructor(readonly id: string, readonly orderId: string, readonly amount: Money) {}

  issue(on: Date): void {
    if (this.issued) throw new Error('Invoice already issued');
    this.issued = true;
    this.events.push(new InvoiceIssued(this.id, this.orderId, on));
  }

  recordPayment(payment: Money, on: Date): void {
    if (!this.issued) throw new Error('Only an issued invoice can be paid');
    this.paidCents += payment.cents;
    if (this.paidCents >= this.amount.cents) this.events.push(new InvoicePaid(this.id, this.orderId, on));
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
