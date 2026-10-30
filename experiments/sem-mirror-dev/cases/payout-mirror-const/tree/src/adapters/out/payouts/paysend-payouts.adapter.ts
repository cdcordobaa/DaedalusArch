import { PaySendClient, PayoutStatus } from 'paysend-sdk';
import { PayoutsPort } from '../../../application/ports/out/payouts.port';
import { PayoutState, PayoutView } from '../../../domain/payout';

export class PaySendPayoutsAdapter implements PayoutsPort {
  private readonly client: PaySendClient;

  constructor(secret: string) {
    this.client = new PaySendClient({ secret });
  }

  async payout(id: string): Promise<PayoutView> {
    const p = await this.client.payout(id);
    return { id: p.payout_id, state: this.toState(p.status) };
  }

  private toState(s: PayoutStatus): PayoutState {
    if (s === 'PO_QUEUED') return PayoutState.Queued;
    if (s === 'PO_SENT') return PayoutState.Sent;
    if (s === 'PO_BOUNCED') return PayoutState.Bounced;
    return PayoutState.HeldCompliance;
  }
}
