import type { Loan } from '../../domain/lending/Loan';
import type { LoanRepository } from '../ports/LoanRepository';

export class ListMemberLoansUseCase {
  constructor(private readonly loans: LoanRepository) {}

  async execute(memberId: string): Promise<Loan[]> {
    return this.loans.findOpenByMember(memberId);
  }
}
