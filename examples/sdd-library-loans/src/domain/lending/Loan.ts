import { DomainError } from '../catalog/errors';
import type { Isbn } from '../catalog/Isbn';

export const LOAN_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

export class NoCopyAvailableError extends DomainError {
  constructor(isbn: string) {
    super('NO_COPY_AVAILABLE', `no copy of ${isbn} is available`);
  }
}

export class BorrowingLimitError extends DomainError {
  constructor(memberId: string, limit: number) {
    super('BORROWING_LIMIT', `member ${memberId} already has ${String(limit)} open loans`);
  }
}

export class AlreadyReturnedError extends DomainError {
  constructor(loanId: string) {
    super('ALREADY_RETURNED', `loan ${loanId} was already returned`);
  }
}

/** One copy of a book lent to one member. */
export class Loan {
  private constructor(
    readonly id: string,
    readonly isbn: Isbn,
    readonly memberId: string,
    readonly loanedAt: Date,
    readonly dueAt: Date,
    private returned: Date | undefined,
  ) {}

  static open(id: string, isbn: Isbn, memberId: string, at: Date): Loan {
    return new Loan(id, isbn, memberId, at, new Date(at.getTime() + LOAN_DAYS * DAY_MS), undefined);
  }

  get returnedAt(): Date | undefined {
    return this.returned;
  }

  get isOpen(): boolean {
    return this.returned === undefined;
  }

  return(at: Date): void {
    if (!this.isOpen) throw new AlreadyReturnedError(this.id);
    this.returned = at;
  }
}
