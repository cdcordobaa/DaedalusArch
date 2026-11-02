/** The policy Covernest issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly state: 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  /** Documents the insurer still wants; empty unless pending. */
  readonly missingDocs: readonly string[];
}
