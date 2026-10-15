import type { InvoiceView } from '../contracts/InvoiceView.js';
import type { IssueInvoice } from '../application/IssueInvoice.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

export class InvoiceController {
  constructor(private readonly issueInvoice: IssueInvoice) {}

  async post(body: { invoiceId: string; orderId: string }): Promise<{ status: number; location: string }> {
    await this.issueInvoice.execute(body.invoiceId, body.orderId);
    return { status: 201, location: `/invoices/${body.invoiceId}` };
  }

  describe(view: InvoiceView): string {
    return `${view.invoiceId}: ${formatCurrency(view.totalCents, view.currency)}`;
  }
}
