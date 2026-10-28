import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class BidPlaced implements DomainEvent {
  readonly type = 'BidPlaced';

  constructor(
    readonly lotId: string,
    readonly bidderId: string,
    readonly amount: number,
    readonly previousBidderId: string | null = null,
  ) {}
}
