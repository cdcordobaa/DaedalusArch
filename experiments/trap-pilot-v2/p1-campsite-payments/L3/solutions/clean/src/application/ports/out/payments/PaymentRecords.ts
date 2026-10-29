import type { PaymentRecord } from '../../../../domain/model/PaymentRecord';

export interface PaymentRecords {
  find(paymentId: string): Promise<PaymentRecord>;
  /** Takes the held money; answers the amount taken in euros, or null when nothing could be taken. */
  take(paymentId: string): Promise<number | null>;
}
