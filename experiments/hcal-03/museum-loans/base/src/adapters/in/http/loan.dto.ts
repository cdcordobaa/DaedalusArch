import { LoanRequest } from '../../../domain/loan-request';
import { Money } from '../../../domain/value-objects';

export interface HttpResponse<T> {
  status: number;
  body: T;
}

export interface RequestLoanBody {
  artworkId: string;
  borrower: string;
  start: string;
  end: string;
}

export interface LoanSummaryDto {
  id: string;
  status: string;
}

export interface ApprovalDto {
  loanId: string;
  premium: string;
  trackingCode: string;
}

export interface LoanDto {
  id: string;
  artworkId: string;
  borrower: string;
  status: string;
}

export function toLoanDto(loan: LoanRequest): LoanDto {
  return { id: loan.id, artworkId: loan.artworkId, borrower: loan.borrower, status: loan.status };
}

export function formatMoney(money: Money): string {
  return money.toString();
}
