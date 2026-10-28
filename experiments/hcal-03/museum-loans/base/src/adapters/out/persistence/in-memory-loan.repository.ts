import { LoanRepository } from '../../../application/ports/out/loan-repository.port';
import { LoanRequest } from '../../../domain/loan-request';

export class InMemoryLoanRepository implements LoanRepository {
  private readonly store = new Map<string, LoanRequest>();

  async save(loan: LoanRequest): Promise<void> {
    this.store.set(loan.id, loan);
  }

  async findById(id: string): Promise<LoanRequest | null> {
    return this.store.get(id) ?? null;
  }
}
