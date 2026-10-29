import type { TillpayClient, TillpayIntentStatus } from 'tillpay-sdk';
import type { HoldState } from '../../../domain/model/HoldState';
import type { PaymentRecord } from '../../../domain/model/PaymentRecord';
import type { PaymentRecords } from '../../../application/ports/out/payments/PaymentRecords';

export class TillpayPaymentRecordsAdapter implements PaymentRecords {
  constructor(private readonly client: TillpayClient) {}

  async find(paymentId: string): Promise<PaymentRecord> {
    const i = await this.client.retrieveIntent(paymentId);
    return { paymentId: i.id, amount: i.amount / 100, providerStatus: i.status, hold: holdOf(i.status) };
  }

  async take(paymentId: string): Promise<number | null> {
    const i = await this.client.captureIntent(paymentId);
    return i.status === 'succeeded' ? i.amount_received / 100 : null;
  }
}

function holdOf(status: TillpayIntentStatus): HoldState {
    if (status === 'requires_capture') return 'held';
    return status === 'requires_action' ? 'needs_guest_approval' : 'not_held';
}
