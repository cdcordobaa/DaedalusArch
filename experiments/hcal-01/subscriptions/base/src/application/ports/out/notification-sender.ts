import { Invoice } from '../../../domain/invoice';

export interface NotificationSender {
  sendInvoice(customerId: string, invoice: Invoice): Promise<void>;
  sendMessage(customerId: string, text: string): Promise<void>;
}
