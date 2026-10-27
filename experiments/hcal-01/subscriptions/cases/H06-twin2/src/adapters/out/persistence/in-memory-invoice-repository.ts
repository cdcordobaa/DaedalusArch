import { InvoiceRepository } from '../../../application/ports/out/invoice-repository';
import { Invoice } from '../../../domain/invoice';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows: Invoice[] = [];
  lastRow: { id: string; cents: number; issuedAt: string } | null = null;

  async save(invoice: Invoice): Promise<void> {
    this.rows.push(invoice);
    this.lastRow = { id: invoice.id, cents: invoice.amount.cents, issuedAt: invoice.issuedAt.toISOString() };
  }

  async findBySubscription(subscriptionId: string): Promise<Invoice[]> {
    return this.rows.filter((i) => i.subscriptionId === subscriptionId);
  }
}
