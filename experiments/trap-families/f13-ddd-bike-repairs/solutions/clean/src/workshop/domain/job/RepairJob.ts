import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import type { PartLine } from '../PartLine';
import { WorkshopError } from '../WorkshopError';
import { JobBooked } from './events/JobBooked';
import { JobCompleted } from './events/JobCompleted';
import type { JobId } from './value-objects/JobId';

export type JobStatus = 'open' | 'completed';

/** Labour a job may carry at completion without the customer's approval of the overrun (4.00 h). */
export const LABOUR_CAP_MINUTES = 240;

export interface RepairJobState {
  readonly id: JobId;
  readonly customer: string;
  readonly bike: string;
  readonly status: JobStatus;
  readonly labourMinutes: number;
  readonly overrunApproved: boolean;
}

/**
 * One bike booked in for repair. Labour is logged in positive amounts while the job is open; a job is completed once,
 * and not with more than the labour cap unless the customer approved the overrun.
 */
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

  logLabour(hours: number): void {
    this.assertOpen();
    const minutes = Math.round(hours * 60);
    if (!(minutes > 0)) throw new WorkshopError('labour must be positive');
    this.minutes += minutes;
  }

  approveOverrun(): void {
    this.assertOpen();
    this.overrunApproved = true;
  }

  /** Completes the job with the parts fitted; the stockroom follows when `JobCompleted` is delivered. */
  complete(parts: readonly PartLine[]): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is already completed`);
    for (const line of parts) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new WorkshopError('a part quantity must be a positive whole number');
    }
    if (this.minutes > LABOUR_CAP_MINUTES && !this.overrunApproved) {
      throw new WorkshopError(
        `labour cap exceeded: ${this.id.value} has ${(this.minutes / 60).toFixed(2)} h logged, ${(LABOUR_CAP_MINUTES / 60).toFixed(2)} h allowed without approval`,
      );
    }
    this.currentStatus = 'completed';
    this.pending.push(new JobCompleted(this.id.value, parts.map((l) => ({ sku: l.sku, quantity: l.quantity }))));
  }

  state(): RepairJobState {
    return {
      id: this.id, customer: this.customer, bike: this.bike, status: this.currentStatus, labourMinutes: this.minutes,
      overrunApproved: this.overrunApproved,
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private assertOpen(): void {
    if (this.currentStatus === 'completed') throw new WorkshopError(`job ${this.id.value} is completed`);
  }
}
