/** Whether the policy issued for a quote is in force, waiting for documents, or void. */
export type PolicyStatus = 'in_force' | 'pending_docs' | 'voided';

/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly status: PolicyStatus;
  /** The documents the insurer still wants; empty unless pending. */
  readonly outstandingDocuments: readonly string[];
}
