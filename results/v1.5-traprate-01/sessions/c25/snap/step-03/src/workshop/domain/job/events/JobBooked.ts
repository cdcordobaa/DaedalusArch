import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class JobBooked implements DomainEvent {
  readonly type = 'JobBooked';

  constructor(
    readonly jobId: string,
    readonly customer: string,
    readonly bike: string,
  ) {}
}
