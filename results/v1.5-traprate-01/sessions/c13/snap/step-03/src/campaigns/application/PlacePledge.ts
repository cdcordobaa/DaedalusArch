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

/** Most a backer may have pledged on one campaign, by standing, in cents. */
const CAP_CENTS: Readonly<Record<string, number>> = {
  trusted: 500_000,
  established: 100_000,
  newcomer: 25_000,
};

export class PlacePledge {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly backers: BackerLookup,
  ) {}

  execute(campaignId: string, backerId: string, amount: number): PledgeReceipt {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    if (!this.backers.isRegistered(backerId)) throw new Error(`no backer ${backerId}`);
    const standing = this.backers.standingOf(backerId);
    if (standing === 'blocked') throw new Error(`backer ${backerId} is blocked`);
    const capCents = standing === undefined ? undefined : CAP_CENTS[standing];
    if (capCents === undefined) throw new Error(`unknown standing for backer ${backerId}`);
    const cap = Amount.ofCents(capCents);
    const requested = Amount.ofUnits(amount);
    if (requested.isPositive() && campaign.pledgedBy(backerId).add(requested).exceeds(cap)) {
      throw new Error(`pledge is over the limit of ${cap.label()} for backer ${backerId} on this campaign`);
    }
    const pledge = campaign.takePledge(backerId, requested);
    this.campaigns.save(campaign);
    return {
      pledgeId: pledge.pledgeId,
      campaignTotal: campaign.raised().units(),
      remaining: cap.subtract(campaign.pledgedBy(backerId)).units(),
    };
  }
}
