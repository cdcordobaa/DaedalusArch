/** The policy issued for a hire's quote, in our own words. */
export type PolicyStatus = 'in_force' | 'pending_docs' | 'voided';

export interface CoverPolicy {
  readonly policyNo: string;
  readonly status: PolicyStatus;
  /** Documents the insurer still wants; empty unless pending_docs. */
  readonly outstandingDocuments: readonly string[];
}
