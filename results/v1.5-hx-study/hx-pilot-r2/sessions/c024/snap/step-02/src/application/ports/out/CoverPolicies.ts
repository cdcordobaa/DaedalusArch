export interface CoverPolicy {
  readonly policyNo: string;
  readonly state: 'in_force' | 'pending_docs' | 'voided';
  readonly missingDocs: string[];
}

export interface CoverPolicies {
  forQuote(quoteRef: string): Promise<CoverPolicy>;
}
