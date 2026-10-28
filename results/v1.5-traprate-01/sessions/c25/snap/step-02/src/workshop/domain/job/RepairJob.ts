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
  readonly overrunApproved: boolean;
}

const LABOUR_CAP_MINUTES = 4 * 60;

/** One bike booked in for repair. Labour is logged in positive amounts. */
export class RepairJob {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: JobId,
    readonly customer: string,
    readonly bike: string,
    private currentStatus: JobStatus,
    private minutes: number,
    private overrunApproved: boolean,
  ) {}

  static book(id: JobId, customer: string, bike: string): RepairJob {
    const job = new RepairJob(id, customer, bike, 'open', 0, false);
    job.pending.push(new JobBooked(id.value, customer, bike));
    return job;
  }

  static restore(state: RepairJobState): RepairJob {
    return new RepairJob(state.id, state.customer, state.bike, state.status, state.labourMinutes, state.overrunApproved);
  }

  get status(): JobStatus {
    return this.currentStatus;
  }

  get labourMinutes(): number {
    return this.minutes;
  }

  complete(): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is already completed`);
    if (this.minutes > LABOUR_CAP_MINUTES && !this.overrunApproved) {
      throw new WorkshopError(
        `labour cap exceeded: ${this.id.value} has ${(this.minutes / 60).toFixed(2)} h logged, ${(LABOUR_CAP_MINUTES / 60).toFixed(2)} h allowed without approval`,
      );
    }
    this.currentStatus = 'completed';
  }

  approveOverrun(): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is completed`);
    this.overrunApproved = true;
  }

  logLabour(hours: number): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is completed`);
    const minutes = Math.round(hours * 60);
    if (!(minutes > 0)) throw new WorkshopError('labour must be positive');
    this.minutes += minutes;
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
