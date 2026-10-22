import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import type { OrderSource } from './ports/OrderSource.js';
import type { Outbox } from './ports/Outbox.js';

/** Application service: coordinates; the invoice computes its own state. */
export class IssueInvoice {
  constructor(private readonly orders: OrderSource, private readonly invoices: InvoiceRepository, private readonly outbox: Outbox) {}

  async execute(invoiceId: string, orderId: string): Promise<void> {
    const order = await this.orders.billableOrder(orderId);
    if (order === null) throw new Error('Unknown order');
    const invoice = new Invoice(invoiceId, order.orderId, Money.of(order.amountCents, order.currency));
    invoice.issue(new Date());
    await this.invoices.save(invoice);
    await this.outbox.append(invoice.pullEvents());
  }
}
