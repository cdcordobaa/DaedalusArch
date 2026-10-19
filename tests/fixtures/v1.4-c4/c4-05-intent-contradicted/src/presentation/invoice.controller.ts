import { InvoiceService } from '../business/invoice.service';
import { InvoiceRepository } from '../persistence/invoice.repository';

export class InvoiceController {
  constructor(
    private readonly invoices: InvoiceService,
    private readonly repo: InvoiceRepository,
  ) {}

  issue(customerId: string, amountCents: number): string {
    return this.invoices.issue(customerId, amountCents);
  }

  cancel(invoiceId: string): void {
    this.repo.markCancelled(invoiceId);
  }
}
