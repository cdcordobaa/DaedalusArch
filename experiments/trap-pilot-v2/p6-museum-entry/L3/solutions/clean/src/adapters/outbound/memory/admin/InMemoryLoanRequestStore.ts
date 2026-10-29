import type { LoanRequestStore } from '../../../../application/ports/out/admin/LoanRequestStore';
import type { LoanRequest } from '../../../../domain/model/admin/LoanRequest';

export class InMemoryLoanRequestStore implements LoanRequestStore {
  private readonly items: LoanRequest[] = [];

  async add(item: LoanRequest): Promise<void> {
    this.items.push(item);
  }

  async all(): Promise<LoanRequest[]> {
    return [...this.items];
  }
}
