import type { ExtensionView, VoucherDesk, VoucherLineView } from '../ports/in/VoucherDesk';
import type { VoucherExtensions } from '../ports/out/VoucherExtensions';
import type { Vouchers } from '../ports/out/Vouchers';

export class VoucherDeskService implements VoucherDesk {
  constructor(
    private readonly vouchers: Vouchers,
    private readonly extensions: VoucherExtensions,
  ) {}

  async line(code: string): Promise<VoucherLineView> {
    const v = await this.vouchers.find(code);
    return { code, line: 'Voucher ' + v.code + ': ' + v.balance.toFixed(2) + ' EUR (' + v.providerStatus + ')' };
  }

  async extend(code: string): Promise<ExtensionView> {
    return { code, result: await this.extensions.extend(code) };
  }
}
