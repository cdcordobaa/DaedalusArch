/** The policy behind a hire: ready to sail, or still waiting for documents. */
export interface PolicyCheck {
  readonly policyNo: string;
  readonly ready: boolean;
  readonly missing: readonly string[];
}
