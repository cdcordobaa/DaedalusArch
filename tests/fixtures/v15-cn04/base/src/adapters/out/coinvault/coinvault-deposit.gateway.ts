import { CoinvaultClient } from 'coinvault-sdk';
import type { DepositGateway } from '../../../application/ports/out/deposit-gateway.port';

export class CoinvaultDepositGateway implements DepositGateway {
  constructor(private readonly client: CoinvaultClient) {}

  async hold(member: string, cents: number): Promise<'held' | 'refused'> {
    const h = await this.client.hold({ customerRef: member, amountCents: cents, currency: 'EUR' });
    if (h.outcome === 'REVIEW') return 'refused';
    return h.outcome === 'APPROVED' ? 'held' : 'refused';
  }
}
