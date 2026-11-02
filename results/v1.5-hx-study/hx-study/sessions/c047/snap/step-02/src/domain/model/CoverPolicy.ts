/** The policy issued for a hire's quote, in the domain's own words. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** in_force: cover is live; pending_docs: the insurer still wants documents; voided: no cover. */
  readonly status: 'in_force' | 'pending_docs' | 'voided';
  /** Documents the insurer still wants. */
  readonly outstandingDocuments: readonly string[];
}
