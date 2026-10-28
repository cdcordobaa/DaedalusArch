import { Campaign, type CampaignSnapshot } from '../domain/campaign/Campaign';
import type { CampaignRepository } from '../domain/campaign/CampaignRepository';
import { CampaignId } from '../domain/campaign/value-objects/CampaignId';
import type { InMemoryOutboxTable } from './InMemoryOutboxTable';

/** Campaigns and the outbox table live in the same store: a save writes both in one step. */
export class InMemoryCampaignRepository implements CampaignRepository {
  private readonly table = new Map<string, CampaignSnapshot>();

  constructor(private readonly outbox: InMemoryOutboxTable) {}

  allocateId(): CampaignId {
    return CampaignId.of(`C-${String(this.table.size + 1).padStart(3, '0')}`);
  }

  find(id: CampaignId): Campaign | undefined {
    const row = this.table.get(id.value);
    return row === undefined ? undefined : Campaign.fromSnapshot(row);
  }

  save(campaign: Campaign): void {
    const events = campaign.releaseEvents();
    this.table.set(campaign.id.value, campaign.snapshot());
    this.outbox.append(events);
  }
}
