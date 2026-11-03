export type PermitOutcome = 'approved' | 'pending' | 'refused';

export interface PermitClearance {
  readonly permitRef: string;
  readonly permitState: string;
  readonly placesLeft: number;
}
