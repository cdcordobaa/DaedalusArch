/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** The insurer's own word for the policy, as it sends it. */
  readonly insurerState: string;
  readonly outstandingDocuments: readonly string[];
}
