/** The policy issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** In force, still waiting for documents, or void. */
  readonly status: 'in_force' | 'pending_docs' | 'void';
  /** The documents the insurer still wants. */
  readonly outstandingDocuments: readonly string[];
}
