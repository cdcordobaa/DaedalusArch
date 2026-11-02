/** The policy Covernest issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly state: 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  readonly missingDocs: readonly string[];
}
