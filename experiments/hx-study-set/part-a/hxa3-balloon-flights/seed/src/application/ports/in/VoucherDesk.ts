/** What came of asking for more time on a voucher, in our own words. */
export type ExtensionResult = 'extended' | 'refused';

export interface VoucherLineView {
  readonly code: string;
  readonly line: string;
}

export interface ExtensionView {
  readonly code: string;
  readonly result: ExtensionResult;
}

export interface VoucherDesk {
  line(code: string): Promise<VoucherLineView>;
  extend(code: string): Promise<ExtensionView>;
}
