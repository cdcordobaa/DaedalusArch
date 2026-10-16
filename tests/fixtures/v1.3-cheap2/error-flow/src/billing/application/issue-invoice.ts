import { Invoice } from '../domain/invoice';
import { InvoiceNotFound } from '../domain/invoice-not-found';

export class IssueInvoice {
  run(amount: number): Invoice {
    const invoice = new Invoice(amount);
    invoice.approve();
    return invoice;
  }

  /** PLANTED P3: a project subclass of NotFoundException thrown in the application layer. */
  find(id: string): Invoice {
    if (id === 'missing') throw new InvoiceNotFound(id);
    return new Invoice(0);
  }
}
