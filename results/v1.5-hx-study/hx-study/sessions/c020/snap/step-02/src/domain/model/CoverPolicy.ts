/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** in_force: cover is live; pending_docs: the insurer still wants documents; voided: no longer valid. */
  readonly status: 'in_force' | 'pending_docs' | 'voided';
  readonly outstandingDocuments: readonly string[];
}
