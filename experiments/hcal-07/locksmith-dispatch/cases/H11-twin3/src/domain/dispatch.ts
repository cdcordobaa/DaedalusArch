export type VisitProgress = 'scheduled' | 'travelling' | 'attended' | 'cancelled';

export interface TechnicianAssignment {
  readonly visitRef: string;
  readonly technicianRef: string | null;
  readonly minutesToArrival: number | null;
}
