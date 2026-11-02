export type CoverPolicy =
  | { readonly state: 'in_force'; readonly policyNo: string }
  | { readonly state: 'pending_docs'; readonly policyNo: string; readonly missingDocs: string[] }
  | { readonly state: 'voided'; readonly policyNo: string };

export interface CoverPolicies {
  forQuote(quoteRef: string): Promise<CoverPolicy>;
}
