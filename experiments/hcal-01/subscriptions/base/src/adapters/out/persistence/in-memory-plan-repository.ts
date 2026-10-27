import { PlanRepository } from '../../../application/ports/out/plan-repository';
import { Plan } from '../../../domain/plan';
import { Money } from '../../../domain/money';

export class InMemoryPlanRepository implements PlanRepository {
  private readonly plans = new Map<string, Plan>([
    ['basic', new Plan('basic', 'Basic', Money.of(900), 1)],
    ['team', new Plan('team', 'Team', Money.of(4900), 10)],
  ]);

  async findById(id: string): Promise<Plan | null> {
    return this.plans.get(id) ?? null;
  }
}
