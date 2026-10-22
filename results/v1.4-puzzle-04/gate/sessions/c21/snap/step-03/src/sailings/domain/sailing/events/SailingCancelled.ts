import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class SailingCancelled implements DomainEvent {
  readonly type = 'SailingCancelled';

  constructor(readonly sailingId: string) {}
}
