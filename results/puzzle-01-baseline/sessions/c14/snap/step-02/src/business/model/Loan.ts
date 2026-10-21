import type { LoanRecord } from '../../persistence/records/LoanRecord';

export const LOAN_DAYS = 14;
export const MAX_OPEN_LOANS = 3;

export interface LoanView {
  readonly loanId: string;
  readonly bookId: string;
  readonly dueDay: string;
  readonly overdue: boolean;
}

export function dueDayFrom(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + LOAN_DAYS);
  return d.toISOString().slice(0, 10);
}

export function toView(record: LoanRecord): LoanView {
  return { loanId: record.id, bookId: record.bookId, dueDay: record.dueDay, overdue: record.overdue };
}
