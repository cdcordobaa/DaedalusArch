import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class LotOpened implements DomainEvent {
  readonly type = 'LotOpened';

  constructor(
    readonly lotId: string,
    readonly title: string,
    readonly openingBid: number,
  ) {}
}
