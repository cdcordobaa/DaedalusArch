import { Plan } from '../../../domain/plan';

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
}
