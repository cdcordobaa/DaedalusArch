import { TillpayError } from 'tillpay-sdk';
import type { TillpayClient } from 'tillpay-sdk';
import type { CaptureResult, PaymentCapture } from '../../../application/ports/out/PaymentCapture';

export class TillpayPaymentCaptureAdapter implements PaymentCapture {
  constructor(private readonly client: TillpayClient) {}

  async capture(paymentId: string): Promise<CaptureResult> {
    try {
      const i = await this.client.captureIntent(paymentId);
      if (i.status !== 'succeeded') return { captured: false };
      return { captured: true, amount: i.amount_received / 100 };
    } catch (e) {
      // A canceled intent or an expired authorisation is refused as a card error; anything else is a real failure.
      if (e instanceof TillpayError && e.kind === 'card_error') return { captured: false };
      throw e;
    }
  }

  async release(paymentId: string): Promise<void> {
    try {
      await this.client.cancelIntent(paymentId);
    } catch (e) {
      // An intent that is already canceled is refused as a card error; the hold is gone either way.
      if (e instanceof TillpayError && e.kind === 'card_error') return;
      throw e;
    }
  }
}
