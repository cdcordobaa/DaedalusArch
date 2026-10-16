import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';

export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice-issued';
  readonly occurredAt = new Date();

  constructor(readonly invoiceId: string, readonly orderId: string) {}
}
