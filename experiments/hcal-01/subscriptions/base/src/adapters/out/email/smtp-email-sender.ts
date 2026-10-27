import { NotificationSender } from '../../../application/ports/out/notification-sender';
import { Invoice } from '../../../domain/invoice';

export class SmtpEmailSender implements NotificationSender {
  constructor(private readonly from = 'billing@example.com') {}

  async sendInvoice(customerId: string, invoice: Invoice): Promise<void> {
    await this.sendMessage(customerId, `Invoice ${invoice.id}: ${invoice.amount.cents} cents`);
  }

  async sendMessage(customerId: string, text: string): Promise<void> {
    console.log(`[smtp from=${this.from}] to=${customerId} ${text}`);
  }
}
