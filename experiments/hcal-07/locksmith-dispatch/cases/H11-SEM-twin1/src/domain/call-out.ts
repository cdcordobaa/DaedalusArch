import { CallOutStatus, LockType, Urgency } from './call-out-status';
import { TechnicianAssignment, VisitProgress } from './dispatch';
import { CallOutNotRequestedError } from './errors';

export class CallOut {
  private status: CallOutStatus = 'REQUESTED';
  private visitRef: string | null = null;
  private technicianRef: string | null = null;

  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly district: string,
    readonly lockType: LockType,
    readonly urgency: Urgency,
  ) {}

  schedule(assignment: TechnicianAssignment): void {
    if (this.status !== 'REQUESTED') throw new CallOutNotRequestedError(this.id);
    this.visitRef = assignment.visitRef;
    this.technicianRef = assignment.technicianRef;
    this.status = 'SCHEDULED';
  }

  recordProgress(progress: VisitProgress): void {
    if (this.status !== 'SCHEDULED') return;
    if (progress === 'attended') this.status = 'ATTENDED';
    if (progress === 'cancelled') this.status = 'CANCELLED';
  }

  canReschedule(): boolean {
    switch (this.status) {
      case 'REQUESTED':
      case 'SCHEDULED':
        return true;
      case 'ATTENDED':
      case 'CANCELLED':
        return false;
    }
  }

  get currentStatus(): CallOutStatus {
    return this.status;
  }

  get visitReference(): string | null {
    return this.visitRef;
  }

  get technicianReference(): string | null {
    return this.technicianRef;
  }
}
