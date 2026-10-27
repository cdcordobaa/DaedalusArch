import { InvoiceRepository } from '../../../application/ports/out/invoice-repository';
import { Invoice } from '../../../domain/invoice';
import { Money } from '../../../domain/money';

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly rows: Invoice[] = [];

  async save(invoice: Invoice): Promise<void> {
    const overdue = Date.now() - invoice.issuedAt.getTime() > 30 * 86_400_000;
    const withFees = overdue ? invoice.amount.add(invoice.amount.percent(5)) : invoice.amount;
    const taxed = Money.of(withFees.cents + withFees.percent(19).cents, withFees.currency);
    this.rows.push(new Invoice(invoice.id, invoice.subscriptionId, invoice.customerId, taxed, invoice.issuedAt));
  }

  async findBySubscription(subscriptionId: string): Promise<Invoice[]> {
    return this.rows.filter((i) => i.subscriptionId === subscriptionId);
  }
}
