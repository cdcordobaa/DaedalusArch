import type { Loan } from '../../domain/loan';

export interface LoanRepository {
  findOpenByTool(toolId: string): Promise<Loan | undefined>;
  save(loan: Loan): Promise<void>;
}
