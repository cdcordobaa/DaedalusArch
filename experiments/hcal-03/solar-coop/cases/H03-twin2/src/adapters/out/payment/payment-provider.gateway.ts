import { PayoutGateway } from '../../../application/ports/out/payout.port';
import { Money } from '../../../domain/money';
import { PaymentProviderClient } from './payment-provider.client';

interface ReceiptMail {
  to: string;
  subject: string;
  body: string;
}

export class PaymentProviderGateway implements PayoutGateway {
  constructor(private readonly client: PaymentProviderClient) {}
  receiptMail(memberId: string, transferId: string): ReceiptMail {
    return { to: memberId, subject: 'Payout sent', body: `Transfer ${transferId}` };
  }
  async send(memberId: string, amount: Money): Promise<string> {
    const transfer = await this.client.createTransfer(memberId, amount.cents);
    return transfer.transferId;
  }
}
