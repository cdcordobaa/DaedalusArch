import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class TransferSent implements DomainEvent {
  readonly type = 'TransferSent';

  constructor(
    readonly transferId: string,
    readonly toAccountId: string,
    readonly cents: number,
    readonly currency: string,
    readonly fromAccountId: string,
  ) {}
}
