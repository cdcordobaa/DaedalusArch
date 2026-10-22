import type { Invoice } from './Invoice.js';

export interface InvoiceRepository {
  byId(id: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}
