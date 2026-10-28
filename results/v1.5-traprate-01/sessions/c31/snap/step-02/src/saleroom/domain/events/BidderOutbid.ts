import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class BidderOutbid implements DomainEvent {
  readonly type = 'BidderOutbid';

  constructor(
    readonly lotId: string,
    readonly bidderId: string,
  ) {}
}
