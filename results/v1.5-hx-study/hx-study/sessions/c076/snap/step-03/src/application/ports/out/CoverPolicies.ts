export interface CoverPolicy {
  readonly policyNo: string;
  readonly state: 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  readonly missingDocs: string[];
}

export interface CoverPolicies {
  forQuote(quoteRef: string): Promise<CoverPolicy>;
}
