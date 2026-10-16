import { Plan } from '../../domain/model/Plan';
import { Subscription } from '../../domain/model/Subscription';

export interface SubscriptionSummary {
  id: string;
  plan: string;
  seats: number;
  state: string;
  monthlyCents: number;
}

export function summarise(subscription: Subscription, plan: Plan): SubscriptionSummary {
  return { id: subscription.id, plan: plan.code, seats: subscription.seats, state: subscription.state, monthlyCents: plan.monthlyCost(subscription.seats) };
}
