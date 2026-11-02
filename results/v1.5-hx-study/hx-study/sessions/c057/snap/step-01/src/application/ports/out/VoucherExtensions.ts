import type { ExtensionResult } from '../in/VoucherDesk';

/** Asking the voucher company for more time on a voucher, in the application's own terms. */
export interface VoucherExtensions {
  extend(code: string): Promise<ExtensionResult>;
}
