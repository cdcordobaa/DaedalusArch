import { CallOutStatus, LockType, Urgency } from './call-out-status';
import { TechnicianAssignment, VisitProgress } from './dispatch';
import { CallOutNotRequestedError } from './errors';

export class CallOut {
  private status: CallOutStatus = 'REQUESTED';
  private visitRef: string | null = null;
  private technicianRef: string | null = null;
  private visitState = 'QUEUED';

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

  trackVisit(vendorState: string): void {
    this.visitState = vendorState;
  }

  canCancel(): boolean {
    return this.status === 'SCHEDULED' && this.visitState !== 'EN_ROUTE' && this.visitState !== 'ON_SITE';
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
