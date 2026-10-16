import { Loan } from '../../business/model/Loan';

export function renderLoan(loan: Loan): Record<string, unknown> {
  return { id: loan.id, isbn: loan.isbn, member: loan.memberId, due: loan.dueDate.toISOString().slice(0, 10) };
}
