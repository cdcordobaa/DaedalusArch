import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class NoShowReported implements DomainEvent {
  readonly type = 'NoShowReported';

  constructor(
    readonly ref: string,
    readonly date: string,
    readonly pitch: string,
    readonly vendorId: string,
  ) {}
}
