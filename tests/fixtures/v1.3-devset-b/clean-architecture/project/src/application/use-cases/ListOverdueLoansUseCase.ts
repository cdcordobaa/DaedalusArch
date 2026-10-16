import { LoanRepository } from '../../domain/repositories/LoanRepository';
import { LoanDto, toLoanDto } from '../dto/LoanDto';
import { Clock } from '../ports/Clock';

export class ListOverdueLoansUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<LoanDto[]> {
    const now = this.clock.now();
    const active = await this.loans.findActive();
    return active.filter((loan) => loan.isOverdue(now)).map((loan) => toLoanDto(loan, now));
  }
}
