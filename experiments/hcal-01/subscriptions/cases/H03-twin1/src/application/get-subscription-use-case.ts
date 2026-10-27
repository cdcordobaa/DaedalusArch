import { GetSubscriptionPort } from './ports/in/get-subscription-port';
import { SubscriptionRepository } from './ports/out/subscription-repository';
import { Subscription } from '../domain/subscription';

export class GetSubscriptionUseCase implements GetSubscriptionPort {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  execute(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.findById(subscriptionId);
  }
}
