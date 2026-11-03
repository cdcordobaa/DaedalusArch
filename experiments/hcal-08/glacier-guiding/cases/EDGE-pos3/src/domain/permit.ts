export type PermitOutcome = 'approved' | 'pending' | 'refused';

export interface PermitClearance {
  readonly permitRef: string;
  readonly outcome: PermitOutcome;
  readonly placesLeft: number;
  readonly receipt: import('icetrail-sdk').PermitResponse;
}
