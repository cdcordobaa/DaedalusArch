export type PolicyStatus = 'in_force' | 'pending_docs' | 'voided';

/** The policy issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly status: PolicyStatus;
  /** Documents the insurer still wants. */
  readonly outstandingDocuments: readonly string[];
}
