import { NotFoundError } from '../../domain/catalog/errors';
import { Isbn } from '../../domain/catalog/Isbn';
import { BorrowingLimitError, Loan, NoCopyAvailableError } from '../../domain/lending/Loan';
import type { BookRepository } from '../ports/BookRepository';
import type { Clock } from '../ports/Clock';
import type { LoanRepository } from '../ports/LoanRepository';
import type { MemberRepository } from '../ports/MemberRepository';

export class LendBookUseCase {
  constructor(
    private readonly books: BookRepository,
    private readonly members: MemberRepository,
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: { readonly isbn: string; readonly memberId: string }): Promise<Loan> {
    const isbn = Isbn.of(cmd.isbn);
    const book = await this.books.findByIsbn(isbn);
    if (book === undefined) throw new NotFoundError(`book ${isbn.value}`);
    const member = await this.members.findById(cmd.memberId);
    if (member === undefined) throw new NotFoundError(`member ${cmd.memberId}`);
    if ((await this.loans.countOpenByIsbn(isbn)) >= book.copies) throw new NoCopyAvailableError(isbn.value);
    if ((await this.loans.countOpenByMember(member.id)) >= member.borrowingLimit) {
      throw new BorrowingLimitError(member.id, member.borrowingLimit);
    }
    const loan = Loan.open(await this.loans.nextId(), isbn, member.id, this.clock.now());
    await this.loans.save(loan);
    return loan;
  }
}
