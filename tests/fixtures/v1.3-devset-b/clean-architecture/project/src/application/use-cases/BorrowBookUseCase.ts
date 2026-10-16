import { Loan } from '../../domain/entities/Loan';
import { DomainError } from '../../domain/errors/DomainError';
import { BookRepository } from '../../domain/repositories/BookRepository';
import { LoanRepository } from '../../domain/repositories/LoanRepository';
import { MemberRepository } from '../../domain/repositories/MemberRepository';
import { LoanPolicy } from '../../domain/services/LoanPolicy';
import { LoanPeriod } from '../../domain/value-objects/LoanPeriod';
import { LoanDto, toLoanDto } from '../dto/LoanDto';
import { Clock } from '../ports/Clock';
import { IdGenerator } from '../ports/IdGenerator';

export interface BorrowBookCommand {
  bookId: string;
  memberId: string;
}

const STANDARD_PERIOD = LoanPeriod.ofDays(21);

export class BorrowBookUseCase {
  private readonly policy = new LoanPolicy();

  constructor(
    private readonly books: BookRepository,
    private readonly members: MemberRepository,
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: BorrowBookCommand): Promise<LoanDto> {
    const book = await this.books.findById(command.bookId);
    if (book === undefined) throw new DomainError('BOOK_NOT_FOUND', `No book ${command.bookId}`);
    const member = await this.members.findById(command.memberId);
    if (member === undefined) throw new DomainError('MEMBER_NOT_FOUND', `No member ${command.memberId}`);

    const now = this.clock.now();
    this.policy.assertCanBorrow(member, await this.loans.findActiveByMember(member.id), now);
    book.checkOut();
    const loan = Loan.open(this.ids.next('loan'), book.id, member.id, now, STANDARD_PERIOD);
    await this.books.save(book);
    await this.loans.save(loan);
    return toLoanDto(loan, now);
  }
}
