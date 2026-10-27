import { PaymentGateway, PaymentResult } from '../../../application/ports/out/payment-gateway';
import { Money } from '../../../domain/money';

export class ProviderPaymentGateway implements PaymentGateway {
  constructor(private readonly apiKey: string) {}

  async charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult> {
    const accepted = this.apiKey.length > 0 && amount.cents > 0;
    return { success: accepted, transactionId: `tx-${customerId}-${reference}` };
  }
}
