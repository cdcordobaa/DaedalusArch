import { CoinvaultClient } from 'coinvault-sdk';
import type { DepositGateway } from '../../../application/ports/out/deposit-gateway.port';
import type { Tool } from '../../../domain/tool';

export class CoinvaultDepositGateway implements DepositGateway {
  constructor(private readonly client: CoinvaultClient) {}

  async hold(member: string, tool: Tool): Promise<'held' | 'refused'> {
    const cents = tool.condition === 'worn' ? tool.depositCents * 2 : tool.depositCents;
    const h = await this.client.hold({ customerRef: member, amountCents: cents, currency: 'EUR' });
    return h.outcome === 'APPROVED' ? 'held' : 'refused';
  }
}
