export interface LoanRecord {
  id: string;
  memberId: string;
  bookId: string;
  /** YYYY-MM-DD */
  dueDay: string;
  returnedDay: string | null;
  overdue: boolean;
}
