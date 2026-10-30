import type { PaymentReceipt, ReceiptView } from '../ports/in/PaymentReceipt';
import type { PaymentRecords } from '../ports/out/PaymentRecords';

export class ReceiptService implements PaymentReceipt {
  constructor(private readonly records: PaymentRecords) {}

  async receipt(paymentId: string): Promise<ReceiptView> {
    const r = await this.records.find(paymentId);
    return { paymentId, line: 'Payment ' + r.paymentId + ': ' + r.amount.toFixed(2) + ' EUR (' + r.providerStatus + ')' };
  }
}
