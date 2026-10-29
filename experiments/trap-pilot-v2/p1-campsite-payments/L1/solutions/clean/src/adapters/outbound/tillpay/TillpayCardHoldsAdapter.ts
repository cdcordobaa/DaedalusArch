import type { TillpayClient } from 'tillpay-sdk';
import type { HoldState } from '../../../domain/model/HoldState';
import type { CardHolds } from '../../../application/ports/out/CardHolds';

export class TillpayCardHoldsAdapter implements CardHolds {
  constructor(private readonly client: TillpayClient) {}

  async stateOf(paymentId: string): Promise<HoldState> {
    const { status } = await this.client.retrieveIntent(paymentId);
    if (status === 'requires_capture') return 'held';
    return 'not_held';
  }

  async take(paymentId: string): Promise<number | null> {
    const i = await this.client.captureIntent(paymentId);
    return i.status === 'succeeded' ? i.amount_received / 100 : null;
  }

  async release(paymentId: string): Promise<void> {
    await this.client.cancelIntent(paymentId);
  }
}
