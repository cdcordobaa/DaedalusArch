import { Amount } from '../../shared-kernel/Amount';
import { Campaign } from '../domain/campaign/Campaign';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';

export class LaunchCampaign {
  constructor(private readonly campaigns: CampaignRepository) {}

  execute(title: string, goal: number): string {
    const campaign = Campaign.launch(this.campaigns.allocateId(), title, Amount.ofUnits(goal));
    this.campaigns.save(campaign);
    return campaign.id.value;
  }
}
