import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class BidderRegistered implements DomainEvent {
  readonly type = 'BidderRegistered';

  constructor(
    readonly accountId: string,
    readonly name: string,
    readonly creditLimit: number,
  ) {}
}
