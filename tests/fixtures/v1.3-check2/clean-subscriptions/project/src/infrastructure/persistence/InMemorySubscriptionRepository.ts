import { Subscription } from '../../domain/model/Subscription';
import { SubscriptionRepository } from '../../domain/ports/SubscriptionRepository';

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly items = new Map<string, Subscription>();

  async byId(id: string): Promise<Subscription | undefined> {
    return this.items.get(id);
  }

  async activeFor(customerId: string): Promise<Subscription[]> {
    return [...this.items.values()].filter((s) => s.customerId === customerId && s.state === 'active');
  }

  async save(subscription: Subscription): Promise<void> {
    this.items.set(subscription.id, subscription);
  }

  nextId(): string {
    return `mem-${this.items.size + 1}`;
  }
}
