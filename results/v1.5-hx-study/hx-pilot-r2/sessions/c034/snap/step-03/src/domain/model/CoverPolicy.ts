/** The policy issued for a hire's quote: in force, waiting for documents, or void. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly status: 'in_force' | 'awaiting_documents' | 'void';
  /** The documents the insurer still wants. */
  readonly missingDocuments: readonly string[];
}
