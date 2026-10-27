export interface PolicyLookup {
  isActive(policyId: string): boolean;
}
