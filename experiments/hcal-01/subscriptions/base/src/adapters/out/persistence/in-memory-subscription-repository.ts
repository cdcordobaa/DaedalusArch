import { SubscriptionRepository } from '../../../application/ports/out/subscription-repository';
import { Subscription } from '../../../domain/subscription';

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly rows = new Map<string, Subscription>();

  async save(subscription: Subscription): Promise<void> {
    this.rows.set(subscription.id, subscription);
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.rows.get(id) ?? null;
  }

  async countActiveByCustomer(customerId: string): Promise<number> {
    return [...this.rows.values()].filter(
      (s) => s.customerId === customerId && s.status === 'active',
    ).length;
  }
}
