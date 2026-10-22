import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** Money has left `fromAccountId` and is owed to `toAccountId`. */
export class MoneyTransferred implements DomainEvent {
  readonly type = 'MoneyTransferred';

  constructor(
    readonly transferId: string,
    readonly fromAccountId: string,
    readonly toAccountId: string,
    readonly currency: string,
    readonly cents: number,
  ) {}
}
