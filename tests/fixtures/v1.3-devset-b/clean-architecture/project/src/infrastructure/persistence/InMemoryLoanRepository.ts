import { Loan } from '../../domain/entities/Loan';
import { LoanRepository } from '../../domain/repositories/LoanRepository';

export class InMemoryLoanRepository implements LoanRepository {
  private readonly rows = new Map<string, Loan>();

  async findById(id: string): Promise<Loan | undefined> {
    return this.rows.get(id);
  }

  async findActiveByMember(memberId: string): Promise<Loan[]> {
    return [...this.rows.values()].filter((loan) => loan.isActive && loan.memberId === memberId);
  }

  async findActive(): Promise<Loan[]> {
    return [...this.rows.values()].filter((loan) => loan.isActive);
  }

  async save(loan: Loan): Promise<void> {
    this.rows.set(loan.id, loan);
  }
}
