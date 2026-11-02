/** The policy issued for a hire's quote, in our own words. */
export type PolicyCover =
  | { readonly kind: 'in_force'; readonly policyNo: string }
  | { readonly kind: 'documents_missing'; readonly policyNo: string; readonly missing: readonly string[] }
  | { readonly kind: 'void'; readonly policyNo: string };

export interface CoverPolicies {
  forQuote(quoteRef: string): Promise<PolicyCover>;
}
