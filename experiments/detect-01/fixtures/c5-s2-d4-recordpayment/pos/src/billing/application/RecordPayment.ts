import { Money } from '../../shared-kernel/value-objects/Money.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import type { OrderPaidNotifier } from './ports/OrderPaid.js';

export class RecordPayment {
  constructor(private readonly invoices: InvoiceRepository, private readonly orders: OrderPaidNotifier) {}

  async execute(invoiceId: string, amountCents: number, currency: string, paidOn: Date): Promise<void> {
    const invoice = await this.invoices.byId(invoiceId);
    if (invoice === null) throw new Error('Unknown invoice');
    invoice.recordPayment(Money.of(amountCents, currency), paidOn);
    await this.invoices.save(invoice);
    for (const e of invoice.pullEvents()) {
      if (e.name === 'billing.invoice-paid') await this.orders.orderPaid(invoice.orderId);
    }
  }
}
