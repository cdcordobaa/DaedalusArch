import type { InvoiceView } from '../contracts/InvoiceView.js';
import type { IssueInvoice } from '../application/IssueInvoice.js';
// Allowed: ordering's service is imported through ordering's public API barrel.
import type { GetOrderSummary } from '../../ordering/index.js';

export class InvoiceController {
  constructor(private readonly issueInvoice: IssueInvoice, private readonly orders?: GetOrderSummary) {}

  async post(body: { invoiceId: string; orderId: string }): Promise<{ status: number; location: string }> {
    await this.issueInvoice.execute(body.invoiceId, body.orderId);
    return { status: 201, location: `/invoices/${body.invoiceId}` };
  }

  describe(view: InvoiceView): string {
    return `${view.invoiceId}: ${String(view.totalCents)} ${view.currency}`;
  }
}
