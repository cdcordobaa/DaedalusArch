export interface CoverageTerms {
  limitCents: number;
  deductibleCents: number;
}

export interface CoverageSource {
  termsFor(policyNumber: string, peril: string, on: Date): Promise<CoverageTerms | undefined>;
}
