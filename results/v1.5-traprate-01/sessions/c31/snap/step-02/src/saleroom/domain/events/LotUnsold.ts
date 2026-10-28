import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class LotUnsold implements DomainEvent {
  readonly type = 'LotUnsold';

  constructor(
    readonly lotId: string,
    readonly bidderId: string | null,
  ) {}
}
