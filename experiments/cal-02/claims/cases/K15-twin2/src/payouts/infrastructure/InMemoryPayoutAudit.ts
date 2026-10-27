import { PayoutAudit } from "../application/PayoutAudit";

export class InMemoryPayoutAudit implements PayoutAudit {
  readonly entries: string[] = [];

  record(payoutId: string, action: string): void {
    this.entries.push(`${payoutId}:${action}`);
  }
}
