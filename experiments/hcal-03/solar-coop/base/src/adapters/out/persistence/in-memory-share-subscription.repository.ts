import { ShareSubscriptionRepository } from '../../../application/ports/out/share-subscription-repository.port';
import { ShareSubscription } from '../../../domain/share-subscription';
import { MemoryDb } from './memory-db';

export class InMemoryShareSubscriptionRepository implements ShareSubscriptionRepository {
  constructor(private readonly db: MemoryDb) {}
  async findAllActive(): Promise<ShareSubscription[]> {
    return [...this.db.subscriptions.values()].filter((s) => s.active);
  }
  async findActiveByMember(memberId: string): Promise<ShareSubscription[]> {
    return (await this.findAllActive()).filter((s) => s.memberId === memberId);
  }
  async save(subscription: ShareSubscription): Promise<void> {
    this.db.subscriptions.set(subscription.id, subscription);
  }
}
