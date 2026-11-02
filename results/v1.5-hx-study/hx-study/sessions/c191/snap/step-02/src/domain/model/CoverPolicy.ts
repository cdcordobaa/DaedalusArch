/** The policy the insurer issued for a hire's quote. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly state: 'in_force' | 'pending_docs' | 'voided';
  /** Documents the insurer still wants; empty unless pending. */
  readonly missingDocs: readonly string[];
}
