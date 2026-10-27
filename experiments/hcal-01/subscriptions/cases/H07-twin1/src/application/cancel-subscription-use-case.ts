import { CancelSubscriptionCommand, CancelSubscriptionPort } from './ports/in/cancel-subscription-port';
import { SubscriptionRepository } from './ports/out/subscription-repository';
import { AlreadyCancelledError, SubscriptionNotFoundError } from '../domain/errors';

export class CancelSubscriptionUseCase implements CancelSubscriptionPort {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    const subscription = await this.subscriptions.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(`Subscription ${command.subscriptionId} not found`);
    }
    if (subscription.status === 'cancelled') {
      throw new AlreadyCancelledError(`Subscription ${subscription.id} was cancelled earlier`);
    }
    subscription.cancel(new Date());
    await this.subscriptions.save(subscription);
  }
}
