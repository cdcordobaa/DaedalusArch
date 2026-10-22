import { Money } from '../../shared-kernel/value-objects/Money.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import type { Outbox } from './ports/Outbox.js';

export class RecordPayment {
  constructor(private readonly invoices: InvoiceRepository, private readonly outbox: Outbox) {}

  async execute(invoiceId: string, amountCents: number, currency: string, paidOn: Date): Promise<void> {
    const invoice = await this.invoices.byId(invoiceId);
    if (invoice === null) throw new Error('Unknown invoice');
    invoice.recordPayment(Money.of(amountCents, currency), paidOn);
    await this.invoices.save(invoice);
    await this.outbox.append(invoice.pullEvents());
  }
}
