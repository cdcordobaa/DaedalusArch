import { LoanRequest } from '../../../domain/loan-request';

export interface GetLoanPort {
  execute(loanId: string): Promise<LoanRequest>;
}
