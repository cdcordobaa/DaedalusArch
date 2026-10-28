import { LoanNotFoundError } from '../domain/errors';
import { ApprovalResult, ApproveLoanPort } from './ports/in/approve-loan.port';
import { CourierGateway } from './ports/out/courier-gateway.port';
import { InsuranceGateway } from './ports/out/insurance-gateway.port';
import { LoanRepository } from './ports/out/loan-repository.port';
import { Notifier } from './ports/out/notifier.port';

export class ApproveLoanUseCase implements ApproveLoanPort {
  constructor(
    private readonly loans: LoanRepository,
    private readonly insurance: InsuranceGateway,
    private readonly courier: CourierGateway,
    private readonly notifier: Notifier,
  ) {}

  async execute(loanId: string): Promise<ApprovalResult> {
    const loan = await this.loans.findById(loanId);
    if (!loan) throw new LoanNotFoundError(loanId);
    const quote = await this.insurance.quote(loan);
    loan.approve();
    const shipment = await this.courier.book(loan);
    loan.markShipped();
    await this.loans.save(loan);
    await this.notifier.notifyBorrower(
      loan.borrower,
      `Loan ${loan.id} approved, tracking ${shipment.trackingCode}`,
    );
    return {
      loanId: loan.id,
      premium: quote.premium.amount,
      currency: quote.premium.currency,
      trackingCode: shipment.trackingCode,
    };
  }
}
