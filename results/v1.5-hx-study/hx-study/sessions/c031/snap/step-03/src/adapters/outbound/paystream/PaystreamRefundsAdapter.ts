import type { PaystreamClient } from 'paystream-sdk';
import type { Refunds } from '../../../application/ports/out/Refunds';
import type { Money } from '../../../domain/model/Money';
import type { RefundReceipt } from '../../../domain/model/RefundReceipt';

export class PaystreamRefundsAdapter implements Refunds {
  constructor(private readonly client: PaystreamClient) {}

  async refund(paymentReference: string, amount: Money): Promise<RefundReceipt> {
    const refund = await this.client.refund({ chargeId: paymentReference, amountMinor: amount.cents, currency: amount.currency });
    return { reference: refund.refundId, settled: refund.state === 'SUCCEEDED' };
  }
}
