/** The policy the insurer issued for a quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly state: 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  /** Documents the insurer still wants. */
  readonly missingDocs: readonly string[];
}
