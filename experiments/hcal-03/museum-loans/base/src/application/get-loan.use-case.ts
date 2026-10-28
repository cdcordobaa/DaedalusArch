import { LoanNotFoundError } from '../domain/errors';
import { LoanRequest } from '../domain/loan-request';
import { GetLoanPort } from './ports/in/get-loan.port';
import { LoanRepository } from './ports/out/loan-repository.port';

export class GetLoanUseCase implements GetLoanPort {
  constructor(private readonly loans: LoanRepository) {}

  async execute(loanId: string): Promise<LoanRequest> {
    const loan = await this.loans.findById(loanId);
    if (!loan) throw new LoanNotFoundError(loanId);
    return loan;
  }
}
