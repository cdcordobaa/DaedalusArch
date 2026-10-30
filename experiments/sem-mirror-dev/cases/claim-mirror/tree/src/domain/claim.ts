export type ClaimProgress = 'opened' | 'assessing' | 'approved' | 'denied' | 'paid';

export interface Claim {
  readonly ref: string;
  readonly progress: ClaimProgress;
  readonly amountCents: number;
}
