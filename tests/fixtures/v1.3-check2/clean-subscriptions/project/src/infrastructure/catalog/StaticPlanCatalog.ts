import { Plan } from '../../domain/model/Plan';
import { PlanCatalog } from '../../domain/ports/PlanCatalog';

export class StaticPlanCatalog implements PlanCatalog {
  private readonly plans = new Map<string, Plan>([
    ['starter', new Plan('starter', 900, 5)],
    ['team', new Plan('team', 1500, 50)],
    ['business', new Plan('business', 2500, 500)],
  ]);

  find(code: string): Plan | undefined {
    return this.plans.get(code);
  }
}
