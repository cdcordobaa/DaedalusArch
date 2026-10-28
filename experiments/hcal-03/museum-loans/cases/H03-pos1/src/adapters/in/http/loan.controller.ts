import { ApproveLoanPort } from '../../../application/ports/in/approve-loan.port';
import { GetLoanPort } from '../../../application/ports/in/get-loan.port';
import { RequestLoanPort } from '../../../application/ports/in/request-loan.port';
import { SystemClock } from '../../out/clock/system.clock';
import { Money } from '../../../domain/value-objects';
import {
  ApprovalDto,
  HttpResponse,
  LoanDto,
  LoanSummaryDto,
  RequestLoanBody,
  formatMoney,
  toLoanDto,
} from './loan.dto';

export class LoanController {
  constructor(
    private readonly requestLoan: RequestLoanPort,
    private readonly approveLoan: ApproveLoanPort,
    private readonly getLoan: GetLoanPort,
  ) {}

  async post(body: RequestLoanBody): Promise<HttpResponse<LoanSummaryDto>> {
    const summary = await this.requestLoan.execute({
      artworkId: body.artworkId,
      borrower: body.borrower,
      start: new Date(body.start),
      end: new Date(body.end),
    });
    const receivedAt = new SystemClock().now().toISOString();
    return { status: 201, body: { id: summary.id, status: summary.status, receivedAt } };
  }

  async approve(id: string): Promise<HttpResponse<ApprovalDto>> {
    const result = await this.approveLoan.execute(id);
    const premium = formatMoney(new Money(result.premium, result.currency));
    return { status: 200, body: { loanId: result.loanId, premium, trackingCode: result.trackingCode } };
  }

  async get(id: string): Promise<HttpResponse<LoanDto>> {
    const loan = await this.getLoan.execute(id);
    return { status: 200, body: toLoanDto(loan) };
  }
}
