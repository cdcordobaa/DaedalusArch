import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class LotClosed implements DomainEvent {
  readonly type = 'LotClosed';

  constructor(
    readonly lotId: string,
    readonly outcome: 'sold' | 'unsold',
    /** The leading bidder when the hammer fell, if any. */
    readonly bidderId: string | null,
    readonly amount: number,
  ) {}
}
