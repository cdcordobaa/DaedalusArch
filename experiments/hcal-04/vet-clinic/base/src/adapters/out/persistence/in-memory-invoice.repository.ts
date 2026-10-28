import type { Invoice } from '../../../domain/invoice';
import type { InvoiceRepositoryPort } from '../../../application/ports/out/invoice-repository.port';

export class InMemoryInvoiceRepository implements InvoiceRepositoryPort {
  private readonly items = new Map<string, Invoice>();

  async save(invoice: Invoice): Promise<void> {
    this.items.set(invoice.id, invoice);
  }

  async findById(id: string): Promise<Invoice | undefined> {
    return this.items.get(id);
  }
}
