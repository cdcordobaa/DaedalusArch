export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly insurerState: 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  readonly missingDocs: string[];
}
