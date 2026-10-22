import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';
import type { Money } from '../../../../shared-kernel/Money';

/** Money has left the sending account and is owed to the receiving one. */
export class MoneyTransferred implements DomainEvent {
  readonly type = 'MoneyTransferred';

  constructor(
    readonly transferId: string,
    readonly fromAccountId: string,
    readonly toAccountId: string,
    readonly amount: Money,
  ) {}
}
