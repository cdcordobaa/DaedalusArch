/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { LendingService } from '../../business/services/LendingService';
import { LoanHistoryService } from '../../business/services/LoanHistoryService';
import { renderLoan } from '../views/LoanView';
import { HttpResult } from './HttpTypes';

export interface LendRequest {
  memberId: string;
  isbn: string;
  days: number;
}

export interface ReturnRequest {
  loanId: string;
}

export class LoanController {
  constructor(
    private readonly lending: LendingService,
    private readonly history: LoanHistoryService,
  ) {}

  async lend(body: LendRequest): Promise<HttpResult> {
    const loan = await this.lending.lend(body.memberId, body.isbn, body.days);
    await this.history.note(loan.id, 'lent');
    return { status: 201, body: renderLoan(loan) };
  }

  async giveBack(body: ReturnRequest): Promise<HttpResult> {
    const fine = await this.lending.giveBack(body.loanId, new Date());
    await this.history.note(body.loanId, 'returned');
    return { status: 200, body: { loanId: body.loanId, fine } };
  }

  async historyOf(loanId: string): Promise<HttpResult> {
    return { status: 200, body: await this.history.eventsOf(loanId) };
  }
}
