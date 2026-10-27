import type { BackerRepository } from '../../backers/domain/backer/BackerRepository';
import { BackerId } from '../../backers/domain/backer/value-objects/BackerId';
import { Amount } from '../../shared-kernel/Amount';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';

export interface PledgeReceipt {
  readonly pledgeId: string;
  readonly campaignTotal: number;
  readonly remaining: number;
}

const CAPS: Record<string, number> = { trusted: 5000, established: 1000, newcomer: 250, blocked: 0 };

export class PlacePledge {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly backers: BackerRepository,
  ) {}

  execute(campaignId: string, backerId: string, amount: number): PledgeReceipt {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    const backer = /^B-\d+$/.test(backerId) ? this.backers.find(BackerId.of(backerId)) : undefined;
    if (backer === undefined) throw new Error(`no backer ${backerId}`);
    const standing = backer.standing();
    if (standing === 'blocked') throw new Error(`backer ${backerId} is blocked`);
    const cap = Amount.ofUnits(CAPS[standing] ?? 0);
    if (campaign.pledgedBy(backerId).add(Amount.ofUnits(amount)).exceeds(cap)) throw new Error('over the limit');
    const pledge = campaign.takePledge(backerId, Amount.ofUnits(amount));
    this.campaigns.save(campaign);
    return { pledgeId: pledge.pledgeId, campaignTotal: campaign.raised().units(), remaining: cap.subtract(campaign.pledgedBy(backerId)).units() };
  }
}
