export type VisitProgress = 'scheduled' | 'attended' | 'cancelled';

export interface TechnicianAssignment {
  readonly visitRef: string;
  readonly technicianRef: string | null;
  readonly minutesToArrival: number | null;
  readonly windowStart: string;
}
