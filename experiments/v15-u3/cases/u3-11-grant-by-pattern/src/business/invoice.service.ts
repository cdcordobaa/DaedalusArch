import { InvoiceRepository } from '../persistence/invoice.repository';

export class InvoiceService {
  constructor(private readonly repo: InvoiceRepository) {}

  issue(customerId: string, amountCents: number): void {
    if (amountCents <= 0) throw new Error('an invoice needs a positive amount');
    this.repo.insert(customerId, amountCents);
  }
}
