export interface PolicyStatus {
  isActive(policyId: string): boolean;
}
