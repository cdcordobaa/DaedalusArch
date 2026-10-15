import { Money } from '../../shared-kernel/value-objects/Money.js';
import { Invoice } from '../domain/invoice/Invoice.js';
import type { InvoiceRepository } from '../domain/invoice/InvoiceRepository.js';
import { InvoiceId } from '../domain/invoice/value-objects/InvoiceId.js';
import type { OrderSource } from './ports/OrderSource.js';
// VIOLATION (context isolation): billing reaches into ordering's domain model instead of its public API.
import type { Order } from '../../ordering/domain/order/Order.js';

/** Application service: coordinates; the invoice computes its own tax. */
export class IssueInvoice {
  constructor(private readonly orders: OrderSource, private readonly invoices: InvoiceRepository, private readonly taxRate: number) {}

  async execute(invoiceId: string, orderId: string): Promise<void> {
    const order = await this.orders.billableOrder(orderId);
    if (order === null) throw new Error('Unknown order');
    const invoice = new Invoice(new InvoiceId(invoiceId), order.orderId, order.currency);
    invoice.charge(`order ${order.orderId}`, Money.of(order.amountCents, order.currency));
    invoice.issue(this.taxRate);
    await this.invoices.save(invoice);
  }

  async executeFor(invoiceId: string, order: Order): Promise<void> {
    await this.execute(invoiceId, order.id.value);
  }
}
