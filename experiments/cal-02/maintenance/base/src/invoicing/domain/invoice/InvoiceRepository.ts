import { Invoice } from './Invoice';

export interface InvoiceRepository {
  save(invoice: Invoice): void;
  findById(id: string): Invoice | undefined;
  findByWorkOrder(workOrderId: string): Invoice | undefined;
  count(): number;
}
