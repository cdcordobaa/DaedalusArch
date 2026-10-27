import { PaymentGateway, PaymentResult } from '../../../application/ports/out/payment-gateway';
import { Money } from '../../../domain/money';
import { SmtpEmailSender } from '../email/smtp-email-sender';

export class ProviderPaymentGateway implements PaymentGateway {
  constructor(private readonly apiKey: string) {}

  async charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult> {
    const accepted = this.apiKey.length > 0 && amount.cents > 0;
    if (accepted) await new SmtpEmailSender().sendMessage(customerId, `Charged ${amount.cents} (${reference})`);
    return { success: accepted, transactionId: `tx-${customerId}-${reference}` };
  }
}
