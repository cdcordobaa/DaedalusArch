/** The cover the insurer issued for a hire's quote, as the wharf needs it at handover. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  /** The paperwork the insurer still wants before the boat may go out; empty when nothing is outstanding. */
  readonly outstandingPaperwork: readonly string[];
}
