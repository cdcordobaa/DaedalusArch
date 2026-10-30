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
    let intent;
    try {
      intent = await this.client.captureIntent(paymentId);
    } catch (e) {
      // A card error means the hold can no longer be taken; anything else is a real failure.
      if (e instanceof TillpayError && e.kind === 'card_error') return { taken: false };
      throw e;
    }
    if (intent.status === 'succeeded') return { taken: true, amount: intent.amount_received / 100 };
    if (intent.status === 'canceled') return { taken: false };
    throw new Error('the payment ' + paymentId + ' is ' + intent.status + ' after capture');
  }
}
