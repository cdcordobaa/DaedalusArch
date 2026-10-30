/** A gift voucher as the voucher line shows it; the balance is in euros. */
export interface VoucherRecord {
  readonly code: string;
  readonly balance: number;
  /** The voucher company's own status text, printed on the voucher line as is. */
  readonly providerStatus: string;
  /** Whether the voucher is in a state in which it may pay for a flight seat. */
  readonly usableForFlight: boolean;
}
