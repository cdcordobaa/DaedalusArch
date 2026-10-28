import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';

export interface ClosingResult {
  readonly outcome: 'funded' | 'failed';
  readonly collected: number;
}

/** The deadline has passed: the campaign is settled. */
export class CloseCampaign {
  constructor(private readonly campaigns: CampaignRepository) {}

  execute(campaignId: string): ClosingResult {
    const campaign = this.campaigns.find(CampaignId.of(campaignId));
    if (campaign === undefined) throw new Error(`no campaign ${campaignId}`);
    const outcome = campaign.close();
    this.campaigns.save(campaign);
    return { outcome: outcome === 'funded' ? 'funded' : 'failed', collected: campaign.collectedPledges().length };
  }
}
