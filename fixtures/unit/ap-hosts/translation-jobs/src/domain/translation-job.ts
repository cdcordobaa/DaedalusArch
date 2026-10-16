import { DomainError } from './domain-error';

export type JobStatus = 'open' | 'assigned' | 'delivered' | 'approved' | 'cancelled';

export class JobStateError extends DomainError {
  constructor(id: string, action: string, status: JobStatus) {
    super('JOB_STATE', `Cannot ${action} job ${id} while it is ${status}`);
  }
}

/** A paid translation job: one document, one language pair, one translator at a time. */
export class TranslationJob {
  status: JobStatus;
  translatorId: string | null;
  deliveredFileUrl: string | null;

  constructor(
    readonly id: string,
    readonly quoteId: string,
    readonly clientId: string,
    readonly pair: string,
    readonly words: number,
    readonly dueAt: Date,
    status: JobStatus,
    translatorId: string | null,
    deliveredFileUrl: string | null,
  ) {
    this.status = status;
    this.translatorId = translatorId;
    this.deliveredFileUrl = deliveredFileUrl;
  }

  assign(translatorId: string): void {
    if (this.status !== 'open' && this.status !== 'assigned') {
      throw new JobStateError(this.id, 'assign', this.status);
    }
    this.translatorId = translatorId;
    this.status = 'assigned';
  }

  deliver(translatorId: string, fileUrl: string): void {
    if (this.status !== 'assigned' || this.translatorId !== translatorId) {
      throw new JobStateError(this.id, 'deliver', this.status);
    }
    this.deliveredFileUrl = fileUrl;
    this.status = 'delivered';
  }

  approve(): void {
    if (this.status !== 'delivered') {
      throw new JobStateError(this.id, 'approve', this.status);
    }
    this.status = 'approved';
  }

  cancel(): void {
    if (this.status === 'approved' || this.status === 'cancelled') {
      throw new JobStateError(this.id, 'cancel', this.status);
    }
    this.status = 'cancelled';
  }

  isLate(now: Date): boolean {
    return this.status !== 'approved' && now.getTime() > this.dueAt.getTime();
  }
}
