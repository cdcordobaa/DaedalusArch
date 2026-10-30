import type { VoucherRecord } from '../../../domain/model/VoucherRecord';

export interface Vouchers {
  find(code: string): Promise<VoucherRecord>;
}
