import type { DomainEvent } from '../../../../shared-kernel/DomainEvent.js';
import type { BillableOrder } from '../../../application/ports/OrderSource.js';

export class InvoiceIssued implements DomainEvent {
  readonly name = 'billing.invoice-issued';
  readonly occurredAt = new Date();

  constructor(readonly invoiceId: string, readonly orderId: string, readonly order?: BillableOrder) {}
}
