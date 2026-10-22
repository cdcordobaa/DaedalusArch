import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** Money left the sending account; the receiving account is credited by a handler of this event. */
export class MoneyTransferred implements DomainEvent {
  readonly type = 'MoneyTransferred';

  constructor(
    readonly transferId: string,
    readonly fromAccountId: string,
    readonly toAccountId: string,
    readonly cents: number,
    readonly currency: string,
  ) {}
}
