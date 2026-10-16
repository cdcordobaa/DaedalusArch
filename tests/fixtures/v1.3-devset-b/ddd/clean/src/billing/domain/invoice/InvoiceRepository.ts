import type { Invoice } from './Invoice.js';
import type { InvoiceId } from './value-objects/InvoiceId.js';

export interface InvoiceRepository {
  byId(id: InvoiceId): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}
