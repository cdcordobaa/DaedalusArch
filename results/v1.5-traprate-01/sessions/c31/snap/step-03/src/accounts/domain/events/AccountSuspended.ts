import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class AccountSuspended implements DomainEvent {
  readonly type = 'AccountSuspended';

  constructor(readonly accountId: string) {}
}
