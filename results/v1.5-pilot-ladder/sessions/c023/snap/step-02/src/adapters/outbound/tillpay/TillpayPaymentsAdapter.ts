import { TillpayError } from 'tillpay-sdk';
import type { TillpayClient } from 'tillpay-sdk';
import type { CaptureResult, Payments } from '../../../application/ports/out/Payments';

export class TillpayPaymentsAdapter implements Payments {
  constructor(private readonly client: TillpayClient) {}

  async isHeld(paymentId: string): Promise<boolean> {
    const intent = await this.client.retrieveIntent(paymentId);
    return intent.status === 'requires_capture';
  }

  async capture(paymentId: string): Promise<CaptureResult> {
    try {
      const intent = await this.client.captureIntent(paymentId);
      if (intent.status !== 'succeeded') return { taken: false };
      return { taken: true, amount: intent.amount_received / 100 };
    } catch (e) {
      // A cancelled or expired hold is refused as a card error; anything else is a real failure.
      if (e instanceof TillpayError && e.kind === 'card_error') return { taken: false };
      throw e;
    }
  }
}
