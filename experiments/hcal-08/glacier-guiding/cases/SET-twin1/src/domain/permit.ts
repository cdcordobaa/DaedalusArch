export type PermitOutcome = 'approved' | 'pending' | 'refused';
export type PermitProgress = 'submitted' | 'in-review' | 'granted' | 'withdrawn';

export interface PermitClearance {
  readonly permitRef: string;
  readonly outcome: PermitOutcome;
  readonly progress: PermitProgress;
  readonly placesLeft: number;
}
