import { InMemoryInvoiceRepository } from '../infrastructure/InMemoryInvoiceRepository';
import { SqlTransaction } from '../infrastructure/SqlTransaction';

export interface InvoiceExporter {
  exportAll(source: InMemoryInvoiceRepository, tx: SqlTransaction): void;
}
