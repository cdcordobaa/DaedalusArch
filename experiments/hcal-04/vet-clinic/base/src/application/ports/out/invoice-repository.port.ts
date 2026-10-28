import type { Invoice } from '../../../domain/invoice';

export interface InvoiceRepositoryPort {
  save(invoice: Invoice): Promise<void>;
  findById(id: string): Promise<Invoice | undefined>;
}
