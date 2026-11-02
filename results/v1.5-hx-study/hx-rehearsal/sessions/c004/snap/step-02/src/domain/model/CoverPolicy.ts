/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** In force, waiting for documents, or voided. */
  readonly status: 'in_force' | 'pending_docs' | 'voided';
  /** The documents the insurer still wants. */
  readonly outstandingDocuments: readonly string[];
}
