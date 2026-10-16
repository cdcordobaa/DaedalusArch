import { Loan } from '../../domain/entities/Loan';

export interface LoanDto {
  id: string;
  bookId: string;
  memberId: string;
  dueAt: string;
  overdue: boolean;
}

export function toLoanDto(loan: Loan, now: Date): LoanDto {
  return {
    id: loan.id,
    bookId: loan.bookId,
    memberId: loan.memberId,
    dueAt: loan.dueAt.toISOString(),
    overdue: loan.isOverdue(now),
  };
}
