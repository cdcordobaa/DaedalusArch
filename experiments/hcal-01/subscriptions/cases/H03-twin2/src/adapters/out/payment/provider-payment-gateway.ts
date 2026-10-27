import { PaymentGateway, PaymentResult } from '../../../application/ports/out/payment-gateway';
import { Money } from '../../../domain/money';

export class ProviderPaymentGateway implements PaymentGateway {
  constructor(
    private readonly apiKey: string,
    private readonly onCharged: (customerId: string, text: string) => void = () => undefined,
  ) {}

  async charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult> {
    const accepted = this.apiKey.length > 0 && amount.cents > 0;
    if (accepted) this.onCharged(customerId, `Charged ${amount.cents} (${reference})`);
    return { success: accepted, transactionId: `tx-${customerId}-${reference}` };
  }
}
