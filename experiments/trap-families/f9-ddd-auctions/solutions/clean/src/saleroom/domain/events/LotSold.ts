import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class LotSold implements DomainEvent {
  readonly type = 'LotSold';

  constructor(
    readonly lotId: string,
    readonly buyerId: string,
    readonly hammerPrice: number,
  ) {}
}
