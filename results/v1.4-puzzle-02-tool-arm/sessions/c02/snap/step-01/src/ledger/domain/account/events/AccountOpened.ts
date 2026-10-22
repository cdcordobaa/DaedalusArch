import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class AccountOpened implements DomainEvent {
  readonly type = 'AccountOpened';

  constructor(
    readonly accountId: string,
    readonly owner: string,
  ) {}
}
