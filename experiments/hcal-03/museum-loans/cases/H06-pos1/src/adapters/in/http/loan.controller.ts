import { ApproveLoanPort } from '../../../application/ports/in/approve-loan.port';
import { GetLoanPort } from '../../../application/ports/in/get-loan.port';
import { RequestLoanPort } from '../../../application/ports/in/request-loan.port';
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
    const days = (new Date(body.end).getTime() - new Date(body.start).getTime()) / 86_400_000;
    if (days > 180) return { status: 422, body: { id: '', status: 'rejected' } };
    const summary = await this.requestLoan.execute({
      artworkId: body.artworkId,
      borrower: body.borrower,
      start: new Date(body.start),
      end: new Date(body.end),
    });
    return { status: 201, body: { id: summary.id, status: summary.status } };
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
