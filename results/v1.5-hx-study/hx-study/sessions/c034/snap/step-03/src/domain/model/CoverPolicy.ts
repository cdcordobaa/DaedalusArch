/** The policy the insurer issued for a quote, as the wharf needs it at handover. */
export interface CoverPolicy {
  readonly policyNo: string;
  readonly quoteRef: string;
  readonly status: 'in_force' | 'pending_docs' | 'voided';
  /** Documents the insurer still wants; empty unless pending_docs. */
  readonly outstanding: readonly string[];
}
