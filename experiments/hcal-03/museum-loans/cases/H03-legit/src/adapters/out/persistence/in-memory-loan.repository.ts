import { LoanRepository } from '../../../application/ports/out/loan-repository.port';
import { LoanRequest } from '../../../domain/loan-request';
import { LoanRecord, toRecord } from './loan.record';

export class InMemoryLoanRepository implements LoanRepository {
  private readonly store = new Map<string, LoanRequest>();
  readonly journal: LoanRecord[] = [];

  async save(loan: LoanRequest): Promise<void> {
    this.store.set(loan.id, loan);
    this.journal.push(toRecord(loan));
  }

  async findById(id: string): Promise<LoanRequest | null> {
    return this.store.get(id) ?? null;
  }
}
