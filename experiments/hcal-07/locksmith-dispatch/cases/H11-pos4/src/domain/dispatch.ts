export type VisitProgress = 'scheduled' | 'attended' | 'cancelled';

export interface TechnicianAssignment {
  readonly visitRef: string;
  readonly technicianRef: string | null;
  readonly minutesToArrival: number | null;
}

export const ASSIGNMENT_FROM_VISIT = {
  visit_uid: 'visitRef',
  tech_uid: 'technicianRef',
  eta_minutes: 'minutesToArrival',
} as const;
