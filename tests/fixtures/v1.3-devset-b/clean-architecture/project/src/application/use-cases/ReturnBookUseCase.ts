import { DomainError } from '../../domain/errors/DomainError';
import { BookRepository } from '../../domain/repositories/BookRepository';
import { LoanRepository } from '../../domain/repositories/LoanRepository';
import { FineCalculator } from '../../domain/services/FineCalculator';
import { LoanDto, toLoanDto } from '../dto/LoanDto';
import { Clock } from '../ports/Clock';

export interface ReturnBookResult {
  loan: LoanDto;
  fineInCents: number;
}

export class ReturnBookUseCase {
  private readonly fines = new FineCalculator(25);

  constructor(
    private readonly loans: LoanRepository,
    private readonly books: BookRepository,
    private readonly clock: Clock,
  ) {}

  async execute(loanId: string): Promise<ReturnBookResult> {
    const loan = await this.loans.findById(loanId);
    if (loan === undefined) throw new DomainError('LOAN_NOT_FOUND', `No loan ${loanId}`);

    const now = this.clock.now();
    const fineInCents = this.fines.fineInCents(loan, now);
    loan.close(now);
    const book = await this.books.findById(loan.bookId);
    if (book !== undefined) {
      book.checkIn();
      await this.books.save(book);
    }
    await this.loans.save(loan);
    return { loan: toLoanDto(loan, now), fineInCents };
  }
}
