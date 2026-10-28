import { ProductionCredit } from '../domain/production-credit';

export interface CreditBatchSummary {
  count: number;
  totalCents: number;
}

export function summarizeCredits(credits: ProductionCredit[]): CreditBatchSummary {
  return {
    count: credits.length,
    totalCents: credits.reduce((sum, c) => sum + c.amount.cents, 0),
  };
}
