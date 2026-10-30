export type VisitState = 'QUEUED' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SITE' | 'CLOSED' | 'VOIDED';
export type CrewClockErrorCode = 'E_SLOT_TAKEN' | 'E_TECH_OFF_SHIFT' | 'E_ZONE_UNKNOWN' | 'E_RATE_LIMIT';

export interface VisitRequest {
  zone_code: string;
  skill_tag: string;
  window_start_iso: string;
  priority_level: number;
}

export interface VisitResponse {
  visit_uid: string;
  visit_state: VisitState;
  tech_uid: string | null;
  eta_minutes: number | null;
  window_start_iso: string;
}

export class SchedulingConflict extends Error {
  code: CrewClockErrorCode;
}

export class CrewClockClient {
  constructor(options: { tenant_id: string; api_secret: string });
  schedule(request: VisitRequest): Promise<VisitResponse>;
  fetch(visit_uid: string): Promise<VisitResponse>;
}
