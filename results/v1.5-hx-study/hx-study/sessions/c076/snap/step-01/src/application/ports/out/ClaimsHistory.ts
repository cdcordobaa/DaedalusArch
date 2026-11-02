import type { RiskBand } from '../in/CheckHirer';

/** A hirer's past claims, in the application's own terms. */
export interface ClaimsHistory {
  bandOf(hirerRef: string): Promise<RiskBand>;
}
