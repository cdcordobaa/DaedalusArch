import { ShareSubscriptionRepository } from '../../../application/ports/out/share-subscription-repository.port';
import { DomainError } from '../../../domain/errors';
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
    const held = (await this.findActiveByMember(subscription.memberId))
      .filter((s) => s.id !== subscription.id)
      .reduce((sum, s) => sum + s.shares, 0);
    if (held + subscription.shares > 100) throw new DomainError('a member may hold at most 100 shares');
    this.db.subscriptions.set(subscription.id, subscription);
  }
}
