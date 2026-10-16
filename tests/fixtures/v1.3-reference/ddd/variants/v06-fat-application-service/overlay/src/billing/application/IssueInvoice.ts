import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';
import type { OrderSource } from './ports/OrderSource.js';

/** VIOLATION (application services hold no business rules): discount and rounding rules live in the service. */
export class IssueInvoice {
  constructor(private readonly orders: OrderSource, private readonly invoices: InvoiceRepository, private readonly taxRate: number) {}

  async execute(invoiceId: string, orderId: string): Promise<void> {
    const order = await this.orders.billableOrder(orderId);
    if (order === null) throw new Error('Unknown order');
    const invoice = new Invoice(new InvoiceId(invoiceId), order.orderId, order.currency);
    const discounted = this.applyVolumeDiscount(order.amountCents);
    invoice.charge(`order ${order.orderId}`, Money.of(this.roundToCents(discounted), order.currency));
    invoice.issue(this.effectiveTaxRate(order.amountCents));
    await this.invoices.save(invoice);
  }

  private applyVolumeDiscount(cents: number): number {
    return cents > 100_000 ? cents * 0.95 : cents;
  }

  private effectiveTaxRate(cents: number): number {
    return cents < 1_000 ? 0 : this.taxRate;
  }

  private roundToCents(value: number): number {
    return Math.round(value);
  }
}
