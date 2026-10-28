import { Amount } from '../../shared-kernel/Amount';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';
import type { BackerLookup } from './ports/BackerLookup';

export interface PledgeReceipt {
  readonly pledgeId: string;
  readonly campaignTotal: number;
  /** Room the backer has left on this campaign after the pledge. */
  readonly remaining: number;
}

const NEWCOMER_LIMIT_CENTS = 25_000;

/** Most a backer may have pledged on one campaign, by standing. */
const LIMIT_CENTS: Readonly<Record<string, number>> = {
  trusted: 500_000,
  established: 100_000,
  newcomer: NEWCOMER_LIMIT_CENTS,
};

export class PlacePledge {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly backers: BackerLookup,
  ) {}

  execute(campaignId: string, backerId: string, amount: number): PledgeReceipt {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    const standing = this.backers.standingOf(backerId);
    if (standing === undefined) throw new Error(`no backer ${backerId}`);
    if (standing === 'blocked') throw new Error(`backer ${backerId} is blocked`);
    const limit = Amount.ofCents(LIMIT_CENTS[standing] ?? NEWCOMER_LIMIT_CENTS);
    const pledge = campaign.takePledge(backerId, Amount.ofUnits(amount), limit);
    this.campaigns.save(campaign);
    return {
      pledgeId: pledge.pledgeId,
      campaignTotal: campaign.raised().units(),
      remaining: limit.subtract(campaign.pledgedBy(backerId)).units(),
    };
  }
}
