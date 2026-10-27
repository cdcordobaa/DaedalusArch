import type { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class LeadingBidStruck implements DomainEvent {
  readonly type = 'LeadingBidStruck';

  constructor(
    readonly lotId: string,
    readonly bidderId: string,
    readonly amount: number,
  ) {}
}
