/** The policy issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  /** Whether the policy is live, still waiting on documents, or no longer valid. */
  readonly status: 'in_force' | 'awaiting_documents' | 'void';
  /** Documents still wanted before the policy is in force. */
  readonly missingDocuments: readonly string[];
}
