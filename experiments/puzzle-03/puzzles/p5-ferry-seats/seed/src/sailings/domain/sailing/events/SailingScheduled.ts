import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SailingScheduled implements DomainEvent {
  readonly type = 'SailingScheduled';

  constructor(
    readonly sailingId: string,
    readonly route: string,
    readonly departsAt: string,
    readonly capacity: number,
  ) {}
}
