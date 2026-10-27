import { Amount } from '../../shared-kernel/Amount';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';
import type { BackerLookup } from './ports/BackerLookup';

export interface PledgeReceipt {
  readonly pledgeId: string;
  readonly campaignTotal: number;
}

export class PlacePledge {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly backers: BackerLookup,
  ) {}

  execute(campaignId: string, backerId: string, amount: number): PledgeReceipt {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    if (!this.backers.isRegistered(backerId)) throw new Error(`no backer ${backerId}`);
    const pledge = campaign.takePledge(backerId, Amount.ofUnits(amount));
    this.campaigns.save(campaign);
    return { pledgeId: pledge.pledgeId, campaignTotal: campaign.raised().units() };
  }
}
