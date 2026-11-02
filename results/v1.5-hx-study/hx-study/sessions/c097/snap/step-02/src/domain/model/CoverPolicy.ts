/** The policy the insurer issued for a quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly status: 'in_force' | 'pending_docs' | 'voided';
  /** Documents the insurer still wants; empty unless the policy is pending documents. */
  readonly outstandingDocuments: readonly string[];
}
