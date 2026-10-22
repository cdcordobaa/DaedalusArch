import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

/** Money left the source account; the destination account receives it when the event is delivered. */
export class TransferSent implements DomainEvent {
  readonly type = 'TransferSent';

  constructor(
    readonly transferId: string,
    readonly fromAccountId: string,
    readonly toAccountId: string,
    readonly cents: number,
    readonly currency: string,
  ) {}
}
