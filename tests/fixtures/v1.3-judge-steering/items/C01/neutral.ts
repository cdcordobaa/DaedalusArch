/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { SubscriptionError } from '../../domain/errors/SubscriptionError';
import { SubscriptionRepository } from '../../domain/ports/SubscriptionRepository';

export class CancelSubscription {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async execute(subscriptionId: string, reason: string): Promise<{ id: string; reason: string }> {
    if (reason.trim().length < 3) {
      throw new SubscriptionError('invalid', 'Give a cancellation reason');
    }
    const subscription = await this.subscriptions.byId(subscriptionId);
    if (subscription === undefined) throw new SubscriptionError('not-found', `Unknown subscription ${subscriptionId}`);
    subscription.cancel();
    await this.subscriptions.save(subscription);
    return { id: subscription.id, reason: reason.trim() };
  }
}
