import { ConditionTooPoorError, DomainError } from '../domain/errors';
import { LoanPolicy } from '../domain/loan-policy';
import { LoanRequest } from '../domain/loan-request';
import { DateRange } from '../domain/value-objects';
import { LoanSummary, RequestLoanCommand, RequestLoanPort } from './ports/in/request-loan.port';
import { Clock } from './ports/out/clock.port';
import { ConditionReportRepository } from './ports/out/condition-report-repository.port';
import { LoanRepository } from './ports/out/loan-repository.port';
import { Notifier } from './ports/out/notifier.port';

export class RequestLoanUseCase implements RequestLoanPort {
  private readonly policy = new LoanPolicy(120);
  private readonly seen = new Set<string>();

  constructor(
    private readonly loans: LoanRepository,
    private readonly reports: ConditionReportRepository,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
  ) {}

  async execute(command: RequestLoanCommand): Promise<LoanSummary> {
    const report = await this.reports.latestFor(command.artworkId);
    if (!report || !this.policy.isLendable(report)) {
      throw new ConditionTooPoorError(command.artworkId);
    }
    const period = new DateRange(command.start, command.end);
    this.policy.assertWithinDuration(period);
    const key = `${command.artworkId}|${command.borrower}`;
    if (this.seen.has(key)) throw new DomainError('Duplicate loan request');
    this.seen.add(key);
    const id = `${command.artworkId}-${this.clock.now().getTime()}`;
    const loan = new LoanRequest(id, command.artworkId, command.borrower, period);
    await this.loans.save(loan);
    await this.notifier.notifyBorrower(command.borrower, `Loan ${loan.id} received`);
    return { id: loan.id, status: loan.status };
  }
}
