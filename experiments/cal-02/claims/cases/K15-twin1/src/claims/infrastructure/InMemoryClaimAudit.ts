import { ClaimAudit } from "../application/ClaimAudit";

export class InMemoryClaimAudit implements ClaimAudit {
  readonly entries: string[] = [];

  record(claimId: string, action: string): void {
    this.entries.push(`${claimId}:${action}`);
  }
}
