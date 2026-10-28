import { ShareSubscriptionRepository } from './ports/out/share-subscription-repository.port';

export class CancelSubscriptionUseCase {
  constructor(private readonly subscriptions: ShareSubscriptionRepository) {}

  async execute(memberId: string): Promise<{ statusCode: number; message: string }> {
    const active = await this.subscriptions.findActiveByMember(memberId);
    if (active.length === 0) return { statusCode: 404, message: 'no active subscription' };
    for (const subscription of active) {
      subscription.cancel();
      await this.subscriptions.save(subscription);
    }
    return { statusCode: 200, message: 'cancelled' };
  }
}
