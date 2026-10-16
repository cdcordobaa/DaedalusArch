import type { LoanRepository } from '../../application/ports/loan-repository';
import { isOpen, type Loan } from '../../domain/loan';

export class InMemoryLoanRepository implements LoanRepository {
  private readonly rows = new Map<string, Loan>();

  async findOpenByTool(toolId: string): Promise<Loan | undefined> {
    return [...this.rows.values()].find((l) => l.toolId === toolId && isOpen(l));
  }

  async findLatestByTool(toolId: string): Promise<Loan | undefined> {
    return [...this.rows.values()]
      .filter((l) => l.toolId === toolId)
      .sort((a, b) => b.lentAt.getTime() - a.lentAt.getTime())[0];
  }

  async save(loan: Loan): Promise<void> {
    this.rows.set(loan.id, loan);
  }
}
