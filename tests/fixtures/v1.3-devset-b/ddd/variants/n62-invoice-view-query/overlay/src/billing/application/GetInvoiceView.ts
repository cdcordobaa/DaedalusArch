import type { InvoiceView } from '../contracts/InvoiceView.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';

export class GetInvoiceView {
  constructor(private readonly invoices: InvoiceRepository) {}

  async viewOf(invoiceId: string): Promise<InvoiceView | null> {
    const invoice = await this.invoices.byId(new InvoiceId(invoiceId));
    if (invoice === null) return null;
    const total = invoice.total();
    return { invoiceId, orderId: invoice.orderId, totalCents: total.cents, currency: total.currency };
  }
}
