import { TillpayError } from 'tillpay-sdk';
import type { TillpayClient } from 'tillpay-sdk';
import type { CaptureResult, Captures } from '../../../application/ports/out/payments/Captures';

export class TillpayCapturesAdapter implements Captures {
  constructor(private readonly client: TillpayClient) {}

  async capture(paymentId: string): Promise<CaptureResult> {
    try {
      const i = await this.client.captureIntent(paymentId);
      if (i.status === 'succeeded') return { outcome: 'succeeded', amountReceived: i.amount_received / 100 };
      if (i.status === 'canceled') return { outcome: 'canceled' };
      throw new Error('the payment ' + paymentId + ' could not be captured, its status is ' + i.status);
    } catch (e) {
      if (e instanceof TillpayError && e.kind === 'card_error') return { outcome: 'canceled' };
      throw e;
    }
  }
}
