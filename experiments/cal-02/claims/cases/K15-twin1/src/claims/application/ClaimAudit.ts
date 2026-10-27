export interface ClaimAudit {
  record(claimId: string, action: string): void;
}
