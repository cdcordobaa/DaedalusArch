import type { InvoiceLine } from './InvoiceLine.js';
import type { InvoiceId } from './value-objects/InvoiceId.js';

export interface InvoiceLineRepository {
  linesOf(invoiceId: InvoiceId): Promise<readonly InvoiceLine[]>;
  append(invoiceId: InvoiceId, line: InvoiceLine): Promise<void>;
}
