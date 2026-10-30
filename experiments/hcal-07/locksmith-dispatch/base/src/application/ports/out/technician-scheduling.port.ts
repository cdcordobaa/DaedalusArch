import { LockType, Urgency } from '../../../domain/call-out-status';
import { TechnicianAssignment } from '../../../domain/dispatch';

export interface SchedulingRequest {
  readonly district: string;
  readonly lockType: LockType;
  readonly urgency: Urgency;
  readonly earliestStart: string;
}

export interface TechnicianSchedulingPort {
  request(request: SchedulingRequest): Promise<TechnicianAssignment>;
}
