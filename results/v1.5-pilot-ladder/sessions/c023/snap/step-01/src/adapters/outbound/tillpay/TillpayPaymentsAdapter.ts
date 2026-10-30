import type { TillpayClient } from 'tillpay-sdk';
import type { Payments } from '../../../application/ports/out/Payments';

export class TillpayPaymentsAdapter implements Payments {
  constructor(private readonly client: TillpayClient) {}

  async isHeld(paymentId: string): Promise<boolean> {
    const intent = await this.client.retrieveIntent(paymentId);
    return intent.status === 'requires_capture';
  }
}
