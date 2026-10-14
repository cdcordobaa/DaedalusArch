import type { DomainEvent } from '../../shared-kernel/DomainEvent.js';

// VIOLATION (domain events are defined in the domain): the event class lives in the application layer.
export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice-issued';
  readonly occurredAt = new Date();

  constructor(readonly invoiceId: string, readonly orderId: string) {}
}
