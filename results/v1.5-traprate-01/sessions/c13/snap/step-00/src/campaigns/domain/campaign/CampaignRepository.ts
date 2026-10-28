import type { Campaign } from './Campaign';
import type { CampaignId } from './value-objects/CampaignId';

export interface CampaignRepository {
  allocateId(): CampaignId;
  find(id: CampaignId): Campaign | undefined;
  /** Stores the campaign and the facts it raised in one step. */
  save(campaign: Campaign): void;
}
