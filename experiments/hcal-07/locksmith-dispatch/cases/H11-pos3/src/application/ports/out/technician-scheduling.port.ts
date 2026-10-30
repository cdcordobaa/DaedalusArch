import { LockType, Urgency } from '../../../domain/call-out-status';

export interface SchedulingRequest {
  readonly district: string;
  readonly lockType: LockType;
  readonly urgency: Urgency;
  readonly earliestStart: string;
}

export interface VisitSlot {
  readonly visit_uid: string;
  readonly tech_uid: string | null;
  readonly eta_minutes: number | null;
  readonly window_start_iso: string;
}

export interface TechnicianSchedulingPort {
  request(request: SchedulingRequest): Promise<VisitSlot>;
}
