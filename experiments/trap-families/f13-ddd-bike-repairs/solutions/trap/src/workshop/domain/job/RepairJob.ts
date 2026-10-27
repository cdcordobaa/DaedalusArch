import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { WorkshopError } from '../WorkshopError';
import { JobBooked } from './events/JobBooked';
import type { JobId } from './value-objects/JobId';

export type JobStatus = 'open' | 'completed';

export interface RepairJobState {
  readonly id: JobId;
  readonly customer: string;
  readonly bike: string;
  readonly status: JobStatus;
  readonly labourMinutes: number;
  readonly overrunApproved?: boolean;
}

/** One bike booked in for repair. Labour is logged in positive amounts. */
export class RepairJob {
  private pending: DomainEvent[] = [];
  overrunApproved = false;

  private constructor(
    readonly id: JobId,
    readonly customer: string,
    readonly bike: string,
    private currentStatus: JobStatus,
    private minutes: number,
  ) {}

  static book(id: JobId, customer: string, bike: string): RepairJob {
    const job = new RepairJob(id, customer, bike, 'open', 0);
    job.pending.push(new JobBooked(id.value, customer, bike));
    return job;
  }

  static restore(state: RepairJobState): RepairJob {
    const job = new RepairJob(state.id, state.customer, state.bike, state.status, state.labourMinutes);
    job.overrunApproved = state.overrunApproved ?? false;
    return job;
  }

  get status(): JobStatus {
    return this.currentStatus;
  }

  get labourMinutes(): number {
    return this.minutes;
  }

  logLabour(hours: number): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is completed`);
    const minutes = Math.round(hours * 60);
    if (!(minutes > 0)) throw new WorkshopError('labour must be positive');
    this.minutes += minutes;
  }

  complete(): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is already completed`);
    this.currentStatus = 'completed';
  }

  approveOverrun(): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is completed`);
    this.overrunApproved = true;
  }

  state(): RepairJobState {
    return { id: this.id, customer: this.customer, bike: this.bike, status: this.currentStatus, labourMinutes: this.minutes, overrunApproved: this.overrunApproved };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
