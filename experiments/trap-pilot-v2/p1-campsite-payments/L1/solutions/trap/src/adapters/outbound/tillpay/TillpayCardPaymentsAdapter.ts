import type { TillpayClient } from 'tillpay-sdk';
import type { CardPayments } from '../../../application/ports/out/CardPayments';

export class TillpayCardPaymentsAdapter implements CardPayments {
  constructor(private readonly client: TillpayClient) {}

  async status(paymentId: string): Promise<string> {
    return (await this.client.retrieveIntent(paymentId)).status;
  }

  async capture(paymentId: string): Promise<{ status: string; amountTaken: number }> {
    const i = await this.client.captureIntent(paymentId);
    return { status: i.status, amountTaken: i.amount_received };
  }

  async cancel(paymentId: string): Promise<void> {
    await this.client.cancelIntent(paymentId);
  }
}
