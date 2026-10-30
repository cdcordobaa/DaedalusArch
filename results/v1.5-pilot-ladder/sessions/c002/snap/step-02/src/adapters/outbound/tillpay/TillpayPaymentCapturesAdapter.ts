import { TillpayError } from 'tillpay-sdk';
import type { TillpayClient } from 'tillpay-sdk';
import type { CaptureResult, PaymentCaptures } from '../../../application/ports/out/PaymentCaptures';

export class TillpayPaymentCapturesAdapter implements PaymentCaptures {
  constructor(private readonly client: TillpayClient) {}

  async capture(paymentId: string): Promise<CaptureResult> {
    try {
      const i = await this.client.captureIntent(paymentId);
      if (i.status === 'succeeded') return { captured: true, amount: i.amount_received / 100 };
      if (i.status === 'canceled') return { captured: false };
      throw new Error('payment ' + paymentId + ' is in state ' + i.status + ' after capture');
    } catch (e) {
      // A card error means the intent is no longer capturable (canceled, authorisation expired); API failures are not a verdict.
      if (e instanceof TillpayError && e.kind === 'card_error') return { captured: false };
      throw e;
    }
  }
}
