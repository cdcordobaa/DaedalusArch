import type { LoanService } from '../business/services/LoanService';
import type { MemberService } from '../business/services/MemberService';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * POST /members, POST /members/:id/suspend, GET /members/:id, GET /members/:id/notices, POST /loans,
 * POST /loans/:id/return, GET /members/:id/loans, POST /nightly.
 */
export class LibraryController {
  constructor(
    private readonly members: MemberService,
    private readonly loans: LoanService,
    private readonly today: () => string,
  ) {}

  register(name: string): HttpResponse {
    return this.handle(() => ({ memberId: this.members.register(name) }));
  }

  borrow(memberId: string, bookId: string): HttpResponse {
    return this.handle(() => this.loans.borrow(memberId, bookId, this.today()));
  }

  returnBook(loanId: string): HttpResponse {
    return this.handle(() => {
      this.loans.returnBook(loanId, this.today());
      return { ok: true };
    });
  }

  loansOf(memberId: string): HttpResponse {
    return this.handle(() => this.loans.openLoans(memberId));
  }

  member(memberId: string): HttpResponse {
    return this.handle(() => ({ memberId, suspended: this.members.isSuspended(memberId) }));
  }

  suspend(memberId: string, reason: string): HttpResponse {
    return this.handle(() => {
      this.members.suspend(memberId, reason);
      return { ok: true };
    });
  }

  notices(memberId: string): HttpResponse {
    return this.handle(() => this.members.notices(memberId));
  }

  nightly(): HttpResponse {
    return this.handle(() => ({ flagged: this.loans.nightly(this.today()) }));
  }

  private handle(run: () => unknown): HttpResponse {
    try {
      return { status: 200, body: run() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
