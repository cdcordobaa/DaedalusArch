import { Invoice } from '../../../domain/invoice';

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findBySubscription(subscriptionId: string): Promise<Invoice[]>;
}
