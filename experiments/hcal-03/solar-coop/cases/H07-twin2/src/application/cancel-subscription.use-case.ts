import { SubscriptionNotFoundError } from '../domain/errors';
import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class CancelSubscriptionUseCase {
  constructor(private readonly subscriptions: ShareSubscriptionRepository) {}

  async execute(memberId: string): Promise<void> {
    const active = await this.subscriptions.findActiveByMember(memberId);
    if (active.length === 0) throw new SubscriptionNotFoundError(memberId);
    for (const subscription of active) {
      subscription.cancel();
      await this.subscriptions.save(subscription);
    }
  }
}
