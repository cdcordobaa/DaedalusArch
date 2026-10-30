import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
  redeem(code: string, amount: number, reference: string): Promise<{ providerResult: string; shortBy: number }>;
}
