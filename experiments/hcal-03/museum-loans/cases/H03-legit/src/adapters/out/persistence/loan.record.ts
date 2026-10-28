import { LoanRequest } from '../../../domain/loan-request';

export interface LoanRecord {
  id: string;
  artworkId: string;
  borrower: string;
  status: string;
  start: string;
  end: string;
}

export function toRecord(loan: LoanRequest): LoanRecord {
  return {
    id: loan.id,
    artworkId: loan.artworkId,
    borrower: loan.borrower,
    status: loan.status,
    start: loan.period.start.toISOString(),
    end: loan.period.end.toISOString(),
  };
}
