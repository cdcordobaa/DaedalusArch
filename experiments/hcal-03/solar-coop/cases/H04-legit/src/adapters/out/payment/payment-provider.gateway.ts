import { PayoutGateway } from '../../../application/ports/out/payout.port';
import { Money } from '../../../domain/money';
import { PaymentProviderClient, ProviderTransfer } from './payment-provider.client';

export class PaymentProviderGateway implements PayoutGateway {
  constructor(private readonly client: PaymentProviderClient) {}
  describe(transfer: ProviderTransfer): string {
    return `${transfer.transferId} to ${transfer.destination}`;
  }
  async send(memberId: string, amount: Money): Promise<string> {
    const transfer = await this.client.createTransfer(memberId, amount.cents);
    return transfer.transferId;
  }
}
