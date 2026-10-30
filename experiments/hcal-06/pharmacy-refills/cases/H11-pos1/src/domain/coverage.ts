export type CoverageVerdict = 'covered' | 'prior-auth' | 'not-covered';

export interface CoverageDecision {
  readonly claimRef: string;
  readonly verdict: CoverageVerdict;
  readonly copayCents: number;
  readonly rejectCodes: readonly string[];
}
