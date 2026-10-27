import { DomainEvent } from '../../shared-kernel/DomainEvent';
import { Invoice } from '../domain/invoice/Invoice';

export interface InvoiceView {
  readonly id: string;
  readonly workOrderId: string;
  readonly status: string;
  readonly totalCents: number;
}

export interface InvoiceCancelledEvent extends DomainEvent {
  readonly name: 'InvoiceCancelled';
  readonly invoiceId: string;
  readonly workOrderId: string;
}

export interface InvoiceLookup {
  find(id: string): Invoice | undefined;
}
