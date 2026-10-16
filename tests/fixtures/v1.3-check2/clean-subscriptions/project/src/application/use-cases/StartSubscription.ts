import { SubscriptionError } from '../../domain/errors/SubscriptionError';
import { Subscription } from '../../domain/model/Subscription';
import { PlanCatalog } from '../../domain/ports/PlanCatalog';
import { SubscriptionRepository } from '../../domain/ports/SubscriptionRepository';
import { SubscriptionSummary, summarise } from '../dto/SubscriptionSummary';

export class StartSubscription {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly plans: PlanCatalog,
  ) {}

  async execute(customerId: string, planCode: string, seats: number): Promise<SubscriptionSummary> {
    if (!Number.isInteger(seats) || seats < 1) {
      throw new SubscriptionError('invalid', 'A subscription needs at least one whole seat');
    }
    const plan = this.plans.find(planCode);
    if (plan === undefined) throw new SubscriptionError('not-found', `Unknown plan ${planCode}`);
    if ((await this.subscriptions.activeFor(customerId)).some((s) => s.planCode === planCode)) {
      throw new SubscriptionError('state', `Customer ${customerId} already has plan ${planCode}`);
    }
    const subscription = Subscription.start(this.subscriptions.nextId(), customerId, plan, seats);
    await this.subscriptions.save(subscription);
    return summarise(subscription, plan);
  }
}
