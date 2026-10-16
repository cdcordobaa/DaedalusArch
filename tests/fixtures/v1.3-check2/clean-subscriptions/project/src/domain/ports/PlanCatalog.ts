import { Plan } from '../model/Plan';

export interface PlanCatalog {
  find(code: string): Plan | undefined;
}
