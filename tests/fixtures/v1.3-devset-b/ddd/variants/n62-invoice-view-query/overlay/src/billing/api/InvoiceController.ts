import type { InvoiceView } from '../contracts/InvoiceView.js';
import type { IssueInvoice } from '../application/IssueInvoice.js';
import type { GetInvoiceView } from '../application/GetInvoiceView.js';

export class InvoiceController {
  constructor(private readonly issueInvoice: IssueInvoice, private readonly views: GetInvoiceView) {}

  async post(body: { invoiceId: string; orderId: string }): Promise<{ status: number; location: string }> {
    await this.issueInvoice.execute(body.invoiceId, body.orderId);
    return { status: 201, location: `/invoices/${body.invoiceId}` };
  }

  async get(invoiceId: string): Promise<{ status: number; body?: InvoiceView }> {
    const view = await this.views.viewOf(invoiceId);
    return view === null ? { status: 404 } : { status: 200, body: view };
  }

  describe(view: InvoiceView): string {
    return `${view.invoiceId}: ${String(view.totalCents)} ${view.currency}`;
  }
}
