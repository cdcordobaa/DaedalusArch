import { Invoice } from '../domain/invoice/Invoice';
import { InvoiceRepository } from '../domain/invoice/InvoiceRepository';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly items = new Map<string, Invoice>();

  save(invoice: Invoice): void {
    this.items.set(invoice.id, invoice);
  }

  findById(id: string): Invoice | undefined {
    return this.items.get(id);
  }

  findByWorkOrder(workOrderId: string): Invoice | undefined {
    return [...this.items.values()].find((i) => i.workOrderId === workOrderId);
  }

  count(): number {
    return this.items.size;
  }
}
