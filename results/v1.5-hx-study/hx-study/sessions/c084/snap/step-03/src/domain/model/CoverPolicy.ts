/** The policy issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  /** Whether the policy is in force, still waiting on documents, or void. */
  readonly cover: 'in_force' | 'pending_docs' | 'void';
  /** The documents the insurer still wants. */
  readonly outstandingDocuments: readonly string[];
}
