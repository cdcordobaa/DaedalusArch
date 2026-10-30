import type { TillpayClient } from 'tillpay-sdk';
import type { PaymentRecord } from '../../../domain/model/PaymentRecord';
import type { PaymentRecords } from '../../../application/ports/out/PaymentRecords';

export class TillpayPaymentRecordsAdapter implements PaymentRecords {
  constructor(private readonly client: TillpayClient) {}

  async find(paymentId: string): Promise<PaymentRecord> {
    const i = await this.client.retrieveIntent(paymentId);
    return { paymentId: i.id, amount: i.amount / 100, providerStatus: i.status, authorized: i.status === 'requires_capture' };
  }
}
