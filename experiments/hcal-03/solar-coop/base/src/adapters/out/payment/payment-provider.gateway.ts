import { PayoutGateway } from '../../../application/ports/out/payout.port';
import { Money } from '../../../domain/money';
import { PaymentProviderClient } from './payment-provider.client';

export class PaymentProviderGateway implements PayoutGateway {
  constructor(private readonly client: PaymentProviderClient) {}
  async send(memberId: string, amount: Money): Promise<string> {
    const transfer = await this.client.createTransfer(memberId, amount.cents);
    return transfer.transferId;
  }
}
