import { Amount } from '../../shared-kernel/Amount';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';
import { PledgeCap } from '../domain/campaign/value-objects/PledgeCap';
import type { BackerLookup } from './ports/BackerLookup';

export interface PledgeReceipt {
  readonly pledgeId: string;
  readonly campaignTotal: number;
  readonly remaining: number;
}

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
    const cap = PledgeCap.forStanding(standing);
    const pledge = campaign.takePledge(backerId, Amount.ofUnits(amount), cap);
    this.campaigns.save(campaign);
    return { pledgeId: pledge.pledgeId, campaignTotal: campaign.raised().units(), remaining: campaign.roomLeftFor(backerId, cap).units() };
  }
}
