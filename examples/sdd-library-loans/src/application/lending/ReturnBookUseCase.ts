import { NotFoundError } from '../../domain/catalog/errors';
import type { Loan } from '../../domain/lending/Loan';
import type { Clock } from '../ports/Clock';
import type { LoanRepository } from '../ports/LoanRepository';

export class ReturnBookUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(loanId: string): Promise<Loan> {
    const loan = await this.loans.findById(loanId);
    if (loan === undefined) throw new NotFoundError(`loan ${loanId}`);
    loan.return(this.clock.now());
    await this.loans.save(loan);
    return loan;
  }
}
