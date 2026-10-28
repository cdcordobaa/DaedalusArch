import { ProductionCredit } from '../../../domain/production-credit';

export interface IssueMonthlyCredits {
  execute(period: string): Promise<ProductionCredit[]>;
}
