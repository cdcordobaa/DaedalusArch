import { CancelSubscriptionCommand, CancelSubscriptionPort } from './ports/in/cancel-subscription-port';
import { SubscriptionRepository } from './ports/out/subscription-repository';
import { InMemorySubscriptionRepository } from '../adapters/out/persistence/in-memory-subscription-repository';
import { SubscriptionNotFoundError } from '../domain/errors';

export class CancelSubscriptionUseCase implements CancelSubscriptionPort {
  constructor(private readonly subscriptions: SubscriptionRepository = new InMemorySubscriptionRepository()) {}

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    const subscription = await this.subscriptions.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription ${command.subscriptionId} not found`);
    }
    subscription.cancel(new Date());
    await this.subscriptions.save(subscription);
  }
}
