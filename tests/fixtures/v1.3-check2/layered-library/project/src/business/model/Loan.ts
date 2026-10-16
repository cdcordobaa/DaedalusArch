import { LendingError } from '../errors/LendingError';

const DAY_MS = 24 * 60 * 60 * 1000;

export class Loan {
  id: string;
  isbn: string;
  memberId: string;
  dueDate: Date;
  returnedAt: Date | null;

  constructor(id: string, isbn: string, memberId: string, dueDate: Date, returnedAt: Date | null = null) {
    this.id = id;
    this.isbn = isbn;
    this.memberId = memberId;
    this.dueDate = dueDate;
    this.returnedAt = returnedAt;
  }

  static open(id: string, isbn: string, memberId: string, start: Date, days: number): Loan {
    return new Loan(id, isbn, memberId, new Date(start.getTime() + days * DAY_MS));
  }

  close(at: Date): void {
    if (this.returnedAt !== null) throw new LendingError('CONFLICT', `Loan ${this.id} is already closed`);
    this.returnedAt = at;
  }

  daysLate(at: Date): number {
    const late = Math.ceil((at.getTime() - this.dueDate.getTime()) / DAY_MS);
    return late > 0 ? late : 0;
  }
}
