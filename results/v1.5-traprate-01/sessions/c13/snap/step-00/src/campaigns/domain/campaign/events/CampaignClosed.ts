import type { DomainEvent } from '../../../../shared-kernel/DomainEvent';

export interface CollectedPledge {
  readonly pledgeId: string;
  readonly backerId: string;
  readonly amountCents: number;
}

export class CampaignClosed implements DomainEvent {
  readonly type = 'CampaignClosed';

  constructor(
    readonly campaignId: string,
    readonly title: string,
    readonly outcome: 'funded' | 'failed',
    readonly raisedCents: number,
    /** The pledges taken from backers; empty when the campaign failed. */
    readonly collected: readonly CollectedPledge[],
  ) {}
}
