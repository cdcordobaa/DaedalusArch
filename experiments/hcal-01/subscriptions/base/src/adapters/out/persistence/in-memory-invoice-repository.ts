import { InvoiceRepository } from '../../../application/ports/out/invoice-repository';
import { Invoice } from '../../../domain/invoice';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows: Invoice[] = [];

  async save(invoice: Invoice): Promise<void> {
    this.rows.push(invoice);
  }

  async findBySubscription(subscriptionId: string): Promise<Invoice[]> {
    return this.rows.filter((i) => i.subscriptionId === subscriptionId);
  }
}
