import type { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import type { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows = new Map<string, Invoice>();

  async byId(id: InvoiceId): Promise<Invoice | null> {
    return this.rows.get(id.value) ?? null;
  }

  async save(invoice: Invoice): Promise<void> {
    this.rows.set(invoice.id.value, invoice);
  }
}
