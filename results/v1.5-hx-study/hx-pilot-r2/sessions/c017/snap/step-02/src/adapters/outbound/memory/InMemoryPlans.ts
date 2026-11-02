import type { SweepPlan } from '../../../domain/model/SweepPlan';
import type { Plans } from '../../../application/ports/out/Plans';

export class InMemoryPlans implements Plans {
  private readonly rows = new Map<string, SweepPlan>();

  async save(plan: SweepPlan): Promise<void> {
    this.rows.set(plan.planId, plan);
  }

  async get(planId: string): Promise<SweepPlan | null> {
    return this.rows.get(planId) ?? null;
  }
}
