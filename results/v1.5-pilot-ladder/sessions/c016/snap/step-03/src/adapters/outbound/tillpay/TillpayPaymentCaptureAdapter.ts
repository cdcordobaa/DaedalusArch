import { TillpayError } from 'tillpay-sdk';
import type { TillpayClient, TillpayIntent } from 'tillpay-sdk';
import type { CaptureResult, PaymentCapture } from '../../../application/ports/out/payments/PaymentCapture';

export class TillpayPaymentCaptureAdapter implements PaymentCapture {
  constructor(private readonly client: TillpayClient) {}

  async capture(paymentId: string): Promise<CaptureResult> {
    let intent: TillpayIntent;
    try {
      intent = await this.client.captureIntent(paymentId);
    } catch (e) {
      if (!(e instanceof TillpayError)) throw e;
      // A canceled or expired intent cannot be captured; anything else is a real failure.
      const current = await this.client.retrieveIntent(paymentId);
      if (current.status === 'canceled') return { outcome: 'canceled' };
      throw e;
    }
    if (intent.status === 'succeeded') return { outcome: 'captured', amountReceived: intent.amount_received / 100 };
    if (intent.status === 'canceled') return { outcome: 'canceled' };
    throw new Error('payment ' + paymentId + ' could not be captured (status ' + intent.status + ')');
  }
}
