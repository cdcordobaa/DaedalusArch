import type { CustomerRef } from '../../shared-kernel/CustomerRef';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository';

export class SettleInvoices {
  constructor(private readonly invoices: InvoiceRepository) {}

  /** Marks the oldest unpaid invoice of the customer as paid. */
  async execute(customer: CustomerRef): Promise<string | null> {
    const [first] = await this.invoices.unpaidFor(customer);
    if (first === undefined) return null;
    first.markPaid();
    await this.invoices.save(first);
    return first.id;
  }
}
