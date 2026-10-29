import type { PaymentRecord } from '../../../domain/model/PaymentRecord';

export interface PaymentRecords {
  find(paymentId: string): Promise<PaymentRecord>;
  capture(paymentId: string): Promise<PaymentRecord>;
  release(paymentId: string): Promise<void>;
}
