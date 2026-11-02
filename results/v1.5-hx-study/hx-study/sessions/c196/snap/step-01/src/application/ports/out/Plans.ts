import type { SweepPlan } from '../../../domain/model/SweepPlan';

export interface Plans {
  save(plan: SweepPlan): Promise<void>;
  get(planId: string): Promise<SweepPlan | null>;
}
