import { DomainError } from '../errors/DomainError';
import { LoanPeriod } from '../value-objects/LoanPeriod';

const DAY_MS = 24 * 60 * 60 * 1000;

export class Loan {
  private returnedAt: Date | undefined;

  private constructor(
    readonly id: string,
    readonly bookId: string,
    readonly memberId: string,
    readonly borrowedAt: Date,
    readonly dueAt: Date,
  ) {}

  static open(id: string, bookId: string, memberId: string, borrowedAt: Date, period: LoanPeriod): Loan {
    return new Loan(id, bookId, memberId, borrowedAt, period.dueDateFrom(borrowedAt));
  }

  get isActive(): boolean {
    return this.returnedAt === undefined;
  }

  close(at: Date): void {
    if (!this.isActive) throw new DomainError('LOAN_CLOSED', `Loan ${this.id} is already returned`);
    this.returnedAt = at;
  }

  isOverdue(now: Date): boolean {
    return this.isActive && now.getTime() > this.dueAt.getTime();
  }

  daysOverdue(now: Date): number {
    if (!this.isOverdue(now)) return 0;
    return Math.ceil((now.getTime() - this.dueAt.getTime()) / DAY_MS);
  }
}
