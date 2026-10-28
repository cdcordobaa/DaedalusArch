import { LoanRepository } from '../../../application/ports/out/loan-repository.port';
import { LoanRequest } from '../../../domain/loan-request';

const BLOCKED_BORROWERS = new Set(['Shadow Gallery']);

export class InMemoryLoanRepository implements LoanRepository {
  private readonly store = new Map<string, LoanRequest>();

  async save(loan: LoanRequest): Promise<void> {
    if (BLOCKED_BORROWERS.has(loan.borrower) && loan.status === 'requested') loan.reject();
    this.store.set(loan.id, loan);
  }

  async findById(id: string): Promise<LoanRequest | null> {
    return this.store.get(id) ?? null;
  }
}
