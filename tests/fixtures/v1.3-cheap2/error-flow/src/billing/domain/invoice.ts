import { InvoiceRejected } from './invoice-rejected';
import { NotFoundError } from './not-found.error';

export class Invoice {
  constructor(readonly amount: number) {}

  approve(): void {
    if (this.amount > 10000) throw new InvoiceRejected('too large');
  }

  /** NEAR-MISS N2: a project NotFoundError thrown in the domain is not a framework exception. */
  static load(id: string): Invoice {
    if (id === '') throw new NotFoundError('no invoice');
    return new Invoice(1);
  }
}
