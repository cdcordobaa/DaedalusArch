import type { TillpayClient } from 'tillpay-sdk';
import type { RefundResult } from '../../../application/ports/in/RefundDeposit';
import type { Refunds } from '../../../application/ports/out/Refunds';

export class TillpayRefundsAdapter implements Refunds {
  constructor(private readonly client: TillpayClient) {}

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    const r = await this.client.refund({ intent: paymentId, amount: Math.round(amount * 100) });
    if (r.state === 'done') return 'refunded';
    return r.state === 'pending' ? 'refund_pending' : 'refund_failed';
  }
}
