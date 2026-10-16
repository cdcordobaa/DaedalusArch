export interface LoanRecord {
  id: string;
  isbn: string;
  memberId: string;
  dueDate: Date;
  returnedAt: Date | null;
}
