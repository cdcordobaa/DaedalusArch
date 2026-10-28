import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export class PledgeMade implements DomainEvent {
  readonly type = 'PledgeMade';

  constructor(
    readonly campaignId: string,
    readonly pledgeId: string,
    readonly backerId: string,
    readonly amountCents: number,
  ) {}
}
