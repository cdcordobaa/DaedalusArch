import { Money } from './money';
import { Plan } from './plan';

export class ProrationService {
  unusedCredit(plan: Plan, daysUsed: number, daysInPeriod: number): Money {
    const remaining = Math.max(daysInPeriod - daysUsed, 0);
    return Money.of(
      Math.round((plan.monthlyPrice.cents * remaining) / daysInPeriod),
      plan.monthlyPrice.currency,
    );
  }
}
