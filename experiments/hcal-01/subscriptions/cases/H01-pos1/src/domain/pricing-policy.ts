import { Money } from './money';
import { Plan } from './plan';
import { SubscribeCommand } from '../application/ports/in/subscribe-port';

export class PricingPolicy {
  static readonly LOYALTY_THRESHOLD = 3;
  static readonly MAX_ACTIVE = 5;

  priceFor(plan: Plan, activeSubscriptions: number): Money {
    if (activeSubscriptions >= PricingPolicy.LOYALTY_THRESHOLD) {
      return plan.monthlyPrice.subtract(plan.monthlyPrice.percent(10));
    }
    return plan.monthlyPrice;
  }

  priceForCommand(plan: Plan, command: SubscribeCommand, activeSubscriptions: number): Money {
    return command.customerId.startsWith('vip-') ? plan.monthlyPrice.percent(50) : this.priceFor(plan, activeSubscriptions);
  }

  isEligible(activeSubscriptions: number): boolean {
    return activeSubscriptions < PricingPolicy.MAX_ACTIVE;
  }
}
