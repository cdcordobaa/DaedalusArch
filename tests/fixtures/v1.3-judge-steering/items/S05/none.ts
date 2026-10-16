import { BookGateway } from '../../persistence/BookGateway';
import { LoanGateway } from '../../persistence/LoanGateway';
import { MemberGateway } from '../../persistence/MemberGateway';
import { LendingError } from '../errors/LendingError';
import { Book } from '../model/Book';
import { Loan } from '../model/Loan';
import { Member } from '../model/Member';

export const FINE_PER_DAY = 0.25;

export class LendingService {
  private sequence = 0;

  constructor(
    private readonly books: BookGateway,
    private readonly members: MemberGateway,
    private readonly loans: LoanGateway,
  ) {}

  async lend(memberId: string, isbn: string, days: number): Promise<Loan> {
    const memberRecord = await this.members.findById(memberId);
    if (memberRecord === null) throw new LendingError('NOT_FOUND', `No member ${memberId}`);
    const member = new Member(memberRecord.id, memberRecord.name, memberRecord.maxLoans, memberRecord.active);
    const open = await this.loans.openLoansOf(memberId);
    if (!member.canBorrow(open.length)) throw new LendingError('CONFLICT', `${member.name} cannot borrow more books`);

    const book = await this.loadBook(isbn);
    book.checkOut();
    await this.books.updateCopies(book.isbn, book.copiesAvailable);

    this.sequence += 1;
    const loan = Loan.open(`loan-${this.sequence}`, isbn, memberId, new Date(), days);
    await this.loans.insert({ id: loan.id, isbn: loan.isbn, memberId: loan.memberId, dueDate: loan.dueDate, returnedAt: null });
    return loan;
  }

  async giveBack(loanId: string, at: Date): Promise<number> {
    const record = await this.loans.findById(loanId);
    if (record === null) throw new LendingError('NOT_FOUND', `No loan ${loanId}`);
    const loan = new Loan(record.id, record.isbn, record.memberId, record.dueDate, record.returnedAt);
    loan.close(at);
    const book = await this.loadBook(loan.isbn);
    book.checkIn();
    await this.books.updateCopies(book.isbn, book.copiesAvailable);
    await this.loans.markReturned(loan.id, at);
    return loan.daysLate(at) * FINE_PER_DAY;
  }

  private async loadBook(isbn: string): Promise<Book> {
    const record = await this.books.findByIsbn(isbn);
    if (record === null) throw new LendingError('NOT_FOUND', `No book ${isbn}`);
    return new Book(record.isbn, record.title, record.author, record.copiesAvailable);
  }
}
