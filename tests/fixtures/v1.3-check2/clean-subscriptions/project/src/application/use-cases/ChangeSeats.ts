import { SubscriptionError } from '../../domain/errors/SubscriptionError';
import { PlanCatalog } from '../../domain/ports/PlanCatalog';
import { SubscriptionRepository } from '../../domain/ports/SubscriptionRepository';
import { SubscriptionSummary, summarise } from '../dto/SubscriptionSummary';

export class ChangeSeats {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly plans: PlanCatalog,
  ) {}

  async execute(subscriptionId: string, seats: number): Promise<SubscriptionSummary> {
    const subscription = await this.subscriptions.byId(subscriptionId);
    if (subscription === undefined) throw new SubscriptionError('not-found', `Unknown subscription ${subscriptionId}`);
    const plan = this.plans.find(subscription.planCode);
    if (plan === undefined) throw new SubscriptionError('not-found', `Unknown plan ${subscription.planCode}`);
    subscription.resize(plan, seats);
    await this.subscriptions.save(subscription);
    return summarise(subscription, plan);
  }
}
