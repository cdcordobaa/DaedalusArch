import { InvoiceRepository } from '../persistence/invoice.repository';

export class InvoiceReportController {
  constructor(private readonly repo: InvoiceRepository) {}

  total(customerId: string): number {
    return this.repo.totalFor(customerId);
  }
}
