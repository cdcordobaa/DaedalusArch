import type { CustomerRef } from '../../../shared-kernel/CustomerRef';
import type { Invoice } from './Invoice';

export interface InvoiceRepository {
  byId(id: string): Promise<Invoice | undefined>;
  unpaidFor(customer: CustomerRef): Promise<readonly Invoice[]>;
  save(invoice: Invoice): Promise<void>;
}
