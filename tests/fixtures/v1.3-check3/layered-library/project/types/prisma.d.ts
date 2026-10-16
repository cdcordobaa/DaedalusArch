declare module '@prisma/client' {
  export interface BookRow { isbn: string; title: string; author: string; copiesAvailable: number }
  export interface MemberRow { id: string; name: string; maxLoans: number; active: boolean }
  export interface LoanRow { id: string; isbn: string; memberId: string; dueDate: Date; returnedAt: Date | null }
  export interface LoanEventRow { id: string; loanId: string; kind: string; at: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    book: Delegate<BookRow, 'isbn'>;
    member: Delegate<MemberRow, 'id'>;
    loan: Delegate<LoanRow, 'id'>;
    loanEvent: Delegate<LoanEventRow, 'id'>;
    $connect(): Promise<void>;
  }
}
