import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** Money has left the sending account and is on its way to the receiving one. */
export class TransferSent implements DomainEvent {
  readonly type = 'TransferSent';

  constructor(
    readonly transferId: string,
    readonly fromAccountId: string,
    readonly toAccountId: string,
    readonly amount: number,
    readonly currency: string,
  ) {}
}
