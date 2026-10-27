import type { BackerRepository } from '../../backers/domain/backer/BackerRepository';
import { BackerId } from '../../backers/domain/backer/value-objects/BackerId';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';

export interface ClosingResult {
  readonly outcome: 'funded' | 'failed';
  readonly collected: number;
}

/** The deadline has passed: the campaign is settled. */
export class CloseCampaign {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly backers: BackerRepository,
  ) {}

  execute(campaignId: string): ClosingResult {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    const outcome = campaign.close();
    this.campaigns.save(campaign);
    for (const p of campaign.collectedPledges()) {
      const backer = this.backers.find(BackerId.of(p.backerId));
      if (backer === undefined) continue;
      backer.addPastBackings(p.amount);
      this.backers.save(backer);
    }
    return { outcome: outcome === 'funded' ? 'funded' : 'failed', collected: campaign.collectedPledges().length };
  }
}
