import type { CustomerRef } from '../../shared-kernel/CustomerRef';
import type { Invoice } from '../domain/invoice/Invoice';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows = new Map<string, Invoice>();

  async byId(id: string): Promise<Invoice | undefined> {
    return this.rows.get(id);
  }

  async unpaidFor(customer: CustomerRef): Promise<readonly Invoice[]> {
    return [...this.rows.values()].filter((i) => i.customer.id === customer.id && !i.isPaid);
  }

  async save(invoice: Invoice): Promise<void> {
    this.rows.set(invoice.id, invoice);
  }
}
