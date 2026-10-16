import { BorrowBookUseCase } from '../application/use-cases/BorrowBookUseCase';
import { ListOverdueLoansUseCase } from '../application/use-cases/ListOverdueLoansUseCase';
import { RegisterBookUseCase } from '../application/use-cases/RegisterBookUseCase';
import { ReturnBookUseCase } from '../application/use-cases/ReturnBookUseCase';
import { BookController } from './http/BookController';
import { LoanController } from './http/LoanController';
import { InMemoryBookRepository } from './persistence/InMemoryBookRepository';
import { InMemoryLoanRepository } from './persistence/InMemoryLoanRepository';
import { InMemoryMemberRepository } from './persistence/InMemoryMemberRepository';
import { SequentialIdGenerator } from './system/SequentialIdGenerator';
import { SystemClock } from './system/SystemClock';

export interface LibraryApp {
  books: BookController;
  loans: LoanController;
  members: InMemoryMemberRepository;
}

/** Composition root (Martin 2017, ch. 26 "The Main Component"): the only place that knows every concrete class. */
export function createLibraryApp(): LibraryApp {
  const books = new InMemoryBookRepository();
  const members = new InMemoryMemberRepository();
  const loans = new InMemoryLoanRepository();
  const clock = new SystemClock();
  const ids = new SequentialIdGenerator();

  return {
    books: new BookController(new RegisterBookUseCase(books, ids)),
    loans: new LoanController(
      new BorrowBookUseCase(books, members, loans, clock, ids),
      new ReturnBookUseCase(loans, books, clock),
      new ListOverdueLoansUseCase(loans, clock),
    ),
    members,
  };
}
