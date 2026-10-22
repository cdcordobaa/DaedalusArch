import type { Invoice } from '../domain/invoice/Invoice';


export class PayInvoice {

  run(invoice: Invoice): void {
    invoice.markPaid();

  }
}
