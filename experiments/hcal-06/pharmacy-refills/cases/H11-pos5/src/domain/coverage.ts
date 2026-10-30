export type CoverageVerdict = 'covered' | 'prior-auth' | 'not-covered';

export interface CoverageDecision {
  readonly claimRef: string;
  readonly verdict: CoverageVerdict;
  readonly copayCents: number;
  readonly claim: {
    readonly claim_ref: string;
    readonly patient_pay_amount: number;
    readonly plan_pay_amount: number;
    readonly adjudicated_at: string;
  };
}
