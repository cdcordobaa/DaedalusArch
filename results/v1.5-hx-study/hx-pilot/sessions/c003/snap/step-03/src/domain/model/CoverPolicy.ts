/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** The insurer's own word for the policy state, e.g. IN_FORCE or PENDING_DOCS. */
  readonly insurerState: string;
  readonly missingDocs: readonly string[];
}
