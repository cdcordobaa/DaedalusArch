export interface PayoutAudit {
  record(payoutId: string, action: string): void;
}
