import type { LoanGateway } from '../../persistence/LoanGateway';
import { LibraryError } from '../errors/LibraryError';
import { dueDayFrom, MAX_OPEN_LOANS, toView, type LoanView } from '../model/Loan';
import type { MemberService } from './MemberService';

export class LoanService {
  constructor(
    private readonly loans: LoanGateway,
    private readonly members: MemberService,
  ) {}

  borrow(memberId: string, bookId: string, today: string): LoanView {
    if (this.members.isSuspended(memberId)) throw new LibraryError(`member ${memberId} is suspended`);
    if (this.loans.openLoansOf(memberId).length >= MAX_OPEN_LOANS) throw new LibraryError(`member ${memberId} already has ${String(MAX_OPEN_LOANS)} books`);
    return toView(this.loans.insert({ memberId, bookId, dueDay: dueDayFrom(today), returnedDay: null, overdue: false }));
  }

  returnBook(loanId: string, today: string): void {
    const loan = this.loans.byId(loanId);
    if (loan === undefined || loan.returnedDay !== null) throw new LibraryError(`no open loan ${loanId}`);
    this.loans.update({ ...loan, returnedDay: today });
    if (loan.overdue && !this.loans.openLoansOf(loan.memberId).some((l) => l.overdue)) {
      this.members.reinstateIfOverdueSuspension(loan.memberId);
    }
  }

  openLoans(memberId: string): LoanView[] {
    return this.loans
      .openLoansOf(memberId)
      .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : 0))
      .map(toView);
  }

  /** The nightly run: flags overdue loans and suspends their holders. */
  nightly(today: string): number {
    const flagged = this.loans.markOverdue(today);
    for (const loan of flagged) {
      this.members.suspend(loan.memberId, `book ${loan.bookId} is overdue`, false);
    }
    return flagged.length;
  }
}
